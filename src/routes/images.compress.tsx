import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { imageOutputFilename, isHeifImage } from '@/lib/imageFiles'
import { downloadBlob } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/compress')({
  component: CompressPage,
})

function CompressPage() {
  const { selectedFile, imageMagickProcessor, clearSelectedFile } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [quality, setQuality] = useWorkspaceState('images.compress.quality', 85)
  const [mode, setMode] = useWorkspaceState<'quality' | 'limit'>(
    'images.compress.mode',
    'quality',
  )
  const [sizeLimit, setSizeLimit] = useWorkspaceState(
    'images.compress.limit',
    '100',
  )
  const [allowResize, setAllowResize] = useWorkspaceState(
    'images.compress.allowResize',
    false,
  )
  const [error, setError] = useWorkspaceState<string | null>(
    'images.compress.error',
    null,
  )
  const { result, setResult, clearResult } = useToolResult(
    selectedFile?.file,
    'images.compress',
  )

  const maximumBytes = Math.floor(Number(sizeLimit) * 1000)
  const validSizeLimit =
    Number.isSafeInteger(maximumBytes) && maximumBytes >= 100
  const resetOutput = () => {
    clearResult()
    setError(null)
  }

  const compressImage = async () => {
    const imageFile = selectedFile
    if (!imageFile || (mode === 'limit' && !validSizeLimit)) return
    const operation = beginOperation()
    resetOutput()

    try {
      const output =
        mode === 'limit'
          ? await imageMagickProcessor.compressToSize(
              imageFile.file,
              maximumBytes,
              allowResize,
            )
          : {
              blob: await imageMagickProcessor.compressImage(imageFile, {
                quality,
              }),
              width: imageFile.dimensions?.width,
              height: imageFile.dimensions?.height,
            }
      if (!operation.isCurrent()) return
      if (!output || (mode === 'limit' && output.blob.size > maximumBytes)) {
        setError(
          allowResize
            ? 'This image could not meet the limit. Try a larger file size.'
            : 'The image could not meet the limit at its current dimensions. Allow smaller dimensions or try a larger file size.',
        )
        return
      }

      const { blob, width, height } = output
      const filename = imageOutputFilename(`compressed_${imageFile.name}`, blob)
      const details = width && height ? [`${width} × ${height} px`] : []
      if (mode === 'limit')
        details.push(`Meets the ${maximumBytes.toLocaleString()}-byte limit`)
      setResult({
        blob,
        filename,
        sourceSize: imageFile.size,
        details,
      })
      downloadBlob(blob, filename)
    } catch {
      if (!operation.isCurrent()) return
      setError(
        'This image could not be compressed. Try another format or choose another image.',
      )
    } finally {
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="p-4 sm:p-6 flex flex-col gap-5">
          <fieldset className="flex flex-wrap gap-2" disabled={isProcessing}>
            <legend className="mb-2 text-sm font-medium">
              Compression goal
            </legend>
            {[
              { value: 'quality', label: 'Choose quality' },
              { value: 'limit', label: 'Set a file size limit' },
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={mode === value ? 'default' : 'outline'}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value === 'limit' ? 'limit' : 'quality')
                  resetOutput()
                }}
              >
                {label}
              </Button>
            ))}
          </fieldset>
          {mode === 'quality' ? (
            <>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Compression presets"
              >
                {[
                  ['Smaller file', 60],
                  ['Balanced', 85],
                  ['Higher quality', 95],
                ].map(([label, value]) => (
                  <Button
                    key={label}
                    variant={quality === value ? 'default' : 'outline'}
                    aria-pressed={quality === value}
                    disabled={isProcessing}
                    onClick={() => {
                      setQuality(Number(value))
                      resetOutput()
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quality" className="text-sm font-medium">
                    Quality: {quality}%
                  </Label>
                </div>
                <Input
                  id="quality"
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(e) => {
                    setQuality(Number(e.target.value))
                    resetOutput()
                  }}
                  disabled={isProcessing}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Smaller file</span>
                  <span>Better quality</span>
                </div>
              </div>
              {selectedFile && isHeifImage(selectedFile) && (
                <p className="text-sm text-muted-foreground">
                  HEIC and HEIF are saved as JPG.
                </p>
              )}
            </>
          ) : (
            <fieldset className="flex flex-col gap-3" disabled={isProcessing}>
              <Label htmlFor="image-size-limit">Maximum file size (KB)</Label>
              <Input
                id="image-size-limit"
                type="number"
                min="0.1"
                step="any"
                inputMode="decimal"
                value={sizeLimit}
                onChange={(event) => {
                  setSizeLimit(event.target.value)
                  resetOutput()
                }}
              />
              <Label className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  checked={allowResize}
                  onChange={(event) => {
                    setAllowResize(event.target.checked)
                    resetOutput()
                  }}
                />
                Allow smaller dimensions if needed
              </Label>
              <p className="text-sm text-muted-foreground">
                Saves a still JPG with a white background where the image is
                transparent. One KB is 1,000 bytes.
              </p>
            </fieldset>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => void compressImage()}
              disabled={
                isProcessing ||
                !selectedFile ||
                (mode === 'limit' && !validSizeLimit)
              }
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Compress & download
            </Button>
          </div>
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        onReset={clearSelectedFile}
        disabled={isProcessing}
      />
    </div>
  )
}
