import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { type ImageConvertOptions } from '@/lib/imagemagick'
import { isHeifImage } from '@/lib/imageFiles'
import { downloadBlob } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/convert')({
  component: ConvertPage,
})

function ConvertPage() {
  const { selectedFile, imageMagickProcessor, clearSelectedFile } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [targetFormat, setTargetFormat] = useWorkspaceState(
    'images.convert.format',
    selectedFile && isHeifImage(selectedFile) ? 'jpg' : 'webp',
  )
  const [error, setError] = useState<string | null>(null)
  const { result, setResult, clearResult } = useToolResult(
    selectedFile?.file,
    'images.convert',
  )
  const changeFormat = (format: string) => {
    setTargetFormat(format)
    clearResult()
    setError(null)
  }

  const convertImage = async (imageFile: typeof selectedFile) => {
    if (!imageFile) {
      console.warn('🖼️ ConvertTool: No file selected')
      return
    }

    console.log('🖼️ ConvertTool: Starting image conversion', {
      fileName: imageFile.name,
      targetFormat,
    })

    const operation = beginOperation()
    setError(null)

    try {
      const options: ImageConvertOptions = {
        targetFormat,
      }

      console.log(
        '🖼️ ConvertTool: Calling ImageMagick convert with options',
        options,
      )
      const blob = await imageMagickProcessor.convertImage(imageFile, options)
      if (!operation.isCurrent()) return
      console.log('🖼️ ConvertTool: Conversion completed', {
        originalSize: imageFile.size,
        newSize: blob.size,
      })

      const filename = `${imageFile.name.replace(/\.[^/.]+$/, '')}.${targetFormat}`
      setResult({
        blob,
        filename,
        sourceSize: imageFile.size,
        details: imageFile.dimensions
          ? [
              `${imageFile.dimensions.width} × ${imageFile.dimensions.height} px`,
            ]
          : [],
      })
      downloadBlob(blob, filename)

      console.log('🖼️ ConvertTool: Conversion successful - file downloaded')
    } catch (error) {
      if (!operation.isCurrent()) return
      console.error('🖼️ ConvertTool: Error during conversion:', error)
      setError(
        'This image could not be converted. Try another format or choose another image.',
      )
    } finally {
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="p-4 sm:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-medium">Target Format</Label>
            <div className="flex flex-col gap-2">
              <div className="flex min-h-11 items-center space-x-2">
                <input
                  type="radio"
                  disabled={isProcessing}
                  id="webp"
                  name="format"
                  value="webp"
                  checked={targetFormat === 'webp'}
                  onChange={(e) => changeFormat(e.target.value)}
                  className="w-4 h-4 text-primary border-border/50"
                />
                <Label
                  htmlFor="webp"
                  className="text-sm font-normal cursor-pointer"
                >
                  WebP (Recommended)
                </Label>
              </div>
              <div className="flex min-h-11 items-center space-x-2">
                <input
                  type="radio"
                  disabled={isProcessing}
                  id="png"
                  name="format"
                  value="png"
                  checked={targetFormat === 'png'}
                  onChange={(e) => changeFormat(e.target.value)}
                  className="w-4 h-4 text-primary border-border/50"
                />
                <Label
                  htmlFor="png"
                  className="text-sm font-normal cursor-pointer"
                >
                  PNG (Lossless)
                </Label>
              </div>
              <div className="flex min-h-11 items-center space-x-2">
                <input
                  type="radio"
                  disabled={isProcessing}
                  id="jpg"
                  name="format"
                  value="jpg"
                  checked={targetFormat === 'jpg'}
                  onChange={(e) => changeFormat(e.target.value)}
                  className="w-4 h-4 text-primary border-border/50"
                />
                <Label
                  htmlFor="jpg"
                  className="text-sm font-normal cursor-pointer"
                >
                  JPG (Compressed)
                </Label>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Converts the first frame of animated images and HEIF sequences.
          </p>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => void convertImage(selectedFile)}
              disabled={isProcessing || !selectedFile}
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Convert & download
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
