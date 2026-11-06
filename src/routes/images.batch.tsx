import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFileOperation } from '@/contexts/FileOperation'
import { useImageTools } from '@/contexts/ImageToolsContext'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { imageOutputFilename } from '@/lib/imageFiles'
import { downloadBlob } from '@/lib/shared'

export const Route = createFileRoute('/images/batch')({
  component: BatchImages,
})

function uniqueName(name: string, usedNames: Set<string>) {
  const safeName = name.replaceAll('/', '_').replaceAll('\\', '_')
  const extension = /\.[^.]+$/.exec(safeName)?.[0] ?? ''
  const stem =
    (extension ? safeName.slice(0, -extension.length) : safeName) || 'image'
  let candidate = `${stem}${extension}`
  let suffix = 2
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}-${suffix}${extension}`
    suffix++
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

function BatchImages() {
  const { batchFiles, imageMagickProcessor, clearBatchFiles, initImageTools } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(batchFiles[0])
  const { result, setResult, clearResult } = useToolResult(
    batchFiles,
    'imageBatch.process',
  )
  const [options, setOptions] = useWorkspaceState('imageBatch.options', {
    mode: 'convert',
    format: 'jpg',
    width: '1600',
    height: '1600',
    failed: [] as string[],
  })
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const width = Number(options.width)
  const height = Number(options.height)
  const valid =
    options.mode === 'convert' ||
    [width, height].every(
      (dimension) =>
        Number.isSafeInteger(dimension) && dimension > 0 && dimension <= 32768,
    )

  const update = (changes: Partial<typeof options>) => {
    setOptions({ ...options, ...changes, failed: [] })
    setError('')
    clearResult()
  }

  const process = async () => {
    if (!batchFiles.length || !valid) return
    const operation = beginOperation()
    setError('')
    setOptions({ ...options, failed: [] })
    clearResult()
    const results = new Map<string, Uint8Array>()
    const usedNames = new Set<string>()
    const failed: string[] = []
    try {
      setProgress('Loading image tools…')
      await initImageTools()
      for (const [index, file] of batchFiles.entries()) {
        if (!operation.isCurrent()) return
        setProgress(`Processing image ${index + 1} of ${batchFiles.length}…`)
        const imageFile = {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: '',
        }
        try {
          const blob =
            options.mode === 'convert'
              ? await imageMagickProcessor.convertImage(imageFile, {
                  targetFormat: options.format,
                })
              : await imageMagickProcessor.resizeImage(imageFile, {
                  width,
                  height,
                  maintainAspectRatio: true,
                  onlyShrink: true,
                })
          const stem = file.name.replace(/\.[^.]+$/, '') || 'image'
          const outputName =
            options.mode === 'convert'
              ? `${stem}.${options.format}`
              : imageOutputFilename(`resized_${file.name}`, blob)
          results.set(
            uniqueName(outputName, usedNames),
            new Uint8Array(await blob.arrayBuffer()),
          )
        } catch {
          failed.push(file.name)
        }
      }
      if (!operation.isCurrent()) return
      setOptions({ ...options, failed })
      if (!results.size) {
        setError(
          'None of the selected images could be processed. Choose another set of images.',
        )
        return
      }
      setProgress('Preparing the ZIP download…')
      const { zipSync } = await import('fflate')
      if (!operation.isCurrent()) return
      const bytes = zipSync(Object.fromEntries(results), { level: 0 })
      const blob = new Blob([bytes], {
        type: 'application/zip',
      })
      const filename =
        options.mode === 'convert'
          ? 'converted-images.zip'
          : 'resized-images.zip'
      setResult({
        blob,
        filename,
        details: [`${results.size} of ${batchFiles.length} images processed`],
      })
      downloadBlob(blob, filename)
    } catch {
      if (operation.isCurrent())
        setError('The ZIP could not be created. Try a smaller batch.')
    } finally {
      if (operation.isCurrent()) setProgress('')
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <fieldset disabled={isProcessing} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-action">Apply to every image</Label>
              <select
                id="batch-action"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                value={options.mode}
                onChange={(event) => update({ mode: event.target.value })}
              >
                <option value="convert">Convert to another format</option>
                <option value="resize">Resize to fit</option>
              </select>
            </div>
            {options.mode === 'convert' ? (
              <div className="space-y-2">
                <Label htmlFor="batch-format">Output format</Label>
                <select
                  id="batch-format"
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                  value={options.format}
                  onChange={(event) => update({ format: event.target.value })}
                >
                  <option value="jpg">JPG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                </select>
                <p className="text-sm text-muted-foreground">
                  Animated images export their first frame.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="batch-width">Maximum width (px)</Label>
                    <Input
                      id="batch-width"
                      type="number"
                      min="1"
                      max="32768"
                      step="1"
                      value={options.width}
                      onChange={(event) =>
                        update({ width: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batch-height">Maximum height (px)</Label>
                    <Input
                      id="batch-height"
                      type="number"
                      min="1"
                      max="32768"
                      step="1"
                      value={options.height}
                      onChange={(event) =>
                        update({ height: event.target.value })
                      }
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keeps proportions and leaves smaller images at their original
                  dimensions. HEIC and HEIF are saved as PNG.
                </p>
              </div>
            )}
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {progress && (
            <p role="status" className="text-sm text-muted-foreground">
              {progress}
            </p>
          )}
          {options.failed.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary>
                {options.failed.length}{' '}
                {options.failed.length === 1 ? 'image could' : 'images could'}{' '}
                not be processed
              </summary>
              <ul className="list-inside list-disc pt-2 break-all">
                {options.failed.map((name, index) => (
                  <li key={`${index}-${name}`}>{name}</li>
                ))}
              </ul>
            </details>
          )}
          <Button
            className="w-full sm:w-auto"
            disabled={isProcessing || !batchFiles.length || !valid}
            onClick={() => void process()}
          >
            {isProcessing
              ? 'Processing images…'
              : 'Process images & download ZIP'}
          </Button>
        </CardContent>
      </Card>
      <ResultCard
        result={result}
        onReset={clearBatchFiles}
        disabled={isProcessing}
      />
    </div>
  )
}
