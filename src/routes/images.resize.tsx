import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { type ResizeOptions } from '@/lib/imagemagick'
import { downloadBlob } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/resize')({
  component: ResizePage,
  head: () => ({
    meta: [
      {
        title:
          'Image Resizer - Free Browser-Based Image Resizing Tool | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based image resizing tool. Resize images to custom dimensions while maintaining aspect ratio. Process images entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free image resizer, resize images, change image dimensions, browser image editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Image Resizer - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based image resizing. Resize images to custom dimensions with complete privacy.',
      },
    ],
  }),
})

function ResizePage() {
  const { selectedFile, imageMagickProcessor, clearSelectedFile } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [settings, setSettings] = useWorkspaceState('images.resize.settings', {
    source: null as File | null,
    width: '',
    height: '',
    maintainAspectRatio: true,
  })
  const [error, setError] = useState<string | null>(null)
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'images.resize',
  )

  useEffect(() => {
    const source = selectedFile?.file ?? null
    if (settings.source === source) return
    setSettings({
      source,
      width: selectedFile?.dimensions?.width.toString() ?? '',
      height: selectedFile?.dimensions?.height.toString() ?? '',
      maintainAspectRatio: true,
    })
    setError(null)
  }, [selectedFile, settings.source, setSettings])

  const setDimension = (field: 'width' | 'height', value: string) => {
    setSettings((previous) => {
      const next = { ...previous, [field]: value }
      const dimensions = selectedFile?.dimensions
      if (previous.maintainAspectRatio && dimensions && Number(value) > 0) {
        const ratio = dimensions.width / dimensions.height
        if (field === 'width')
          next.height = String(Math.max(1, Math.round(Number(value) / ratio)))
        else next.width = String(Math.max(1, Math.round(Number(value) * ratio)))
      }
      return next
    })
  }

  const applyPercentage = (percentage: number) => {
    if (!selectedFile?.dimensions) return
    setSettings((previous) => ({
      ...previous,
      width: String(
        Math.max(1, Math.round(selectedFile.dimensions!.width * percentage)),
      ),
      height: String(
        Math.max(1, Math.round(selectedFile.dimensions!.height * percentage)),
      ),
    }))
  }

  const validDimensions =
    Number.isInteger(Number(settings.width)) &&
    Number(settings.width) > 0 &&
    Number.isInteger(Number(settings.height)) &&
    Number(settings.height) > 0

  const resizeImage = async () => {
    if (!selectedFile || !validDimensions) return
    const operation = beginOperation()
    setError(null)
    try {
      const options: ResizeOptions = {
        width: Number(settings.width),
        height: Number(settings.height),
        maintainAspectRatio: settings.maintainAspectRatio,
      }
      const blob = await imageMagickProcessor.resizeImage(selectedFile, options)
      if (!operation.isCurrent()) return
      const filename = `resized_${selectedFile.name}`
      const dimensions = selectedFile.dimensions
      const ratio =
        settings.maintainAspectRatio && dimensions
          ? Math.min(
              options.width / dimensions.width,
              options.height / dimensions.height,
            )
          : null
      const width =
        ratio && dimensions
          ? Math.round(dimensions.width * ratio)
          : options.width
      const height =
        ratio && dimensions
          ? Math.round(dimensions.height * ratio)
          : options.height
      setResult({
        blob,
        filename,
        sourceSize: selectedFile.size,
        details: [`${width} × ${height} px`],
      })
      downloadBlob(blob, filename)
    } catch {
      if (!operation.isCurrent()) return
      setError(
        'This image could not be resized. Check the dimensions or choose another image.',
      )
    } finally {
      operation.finish()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-5 p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">Image dimensions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with the original size or choose a percentage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Resize presets">
            {[0.25, 0.5, 0.75, 1].map((percentage) => (
              <Button
                key={percentage}
                variant="outline"
                disabled={!selectedFile || isProcessing}
                onClick={() => applyPercentage(percentage)}
              >
                {percentage === 1 ? 'Original size' : `${percentage * 100}%`}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                min="1"
                step="1"
                value={settings.width}
                disabled={!selectedFile || isProcessing}
                onChange={(event) => setDimension('width', event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                min="1"
                step="1"
                value={settings.height}
                disabled={!selectedFile || isProcessing}
                onChange={(event) => setDimension('height', event.target.value)}
              />
            </div>
          </div>
          <Label
            htmlFor="aspect-ratio"
            className="flex min-h-11 cursor-pointer items-center gap-3"
          >
            <Checkbox
              id="aspect-ratio"
              checked={settings.maintainAspectRatio}
              disabled={isProcessing}
              onCheckedChange={(checked) =>
                setSettings((previous) => ({
                  ...previous,
                  maintainAspectRatio: checked === true,
                }))
              }
            />
            Keep aspect ratio
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            onClick={() => void resizeImage()}
            disabled={isProcessing || !validDimensions || !selectedFile}
            className="w-full sm:w-auto sm:self-end"
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resize & download
          </Button>
        </CardContent>
      </Card>
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
