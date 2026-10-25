import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { ResultCard, useToolResult } from '@/components/ResultCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { type ImageCompressOptions } from '@/lib/imagemagick'
import { downloadBlob } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/compress')({
  component: CompressPage,
  head: () => ({
    meta: [
      {
        title:
          'Image Compressor - Free Browser-Based Image Compression | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based image compression tool. Reduce image file sizes while maintaining quality. Process images entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free image compressor, reduce image size, browser image compression, privacy-focused, no upload',
      },
      {
        property: 'og:title',
        content: 'Image Compressor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based image compression. Reduce file sizes while maintaining quality.',
      },
    ],
  }),
})

function CompressPage() {
  const { selectedFile, imageMagickProcessor, clearSelectedFile } =
    useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)
  const [quality, setQuality] = useWorkspaceState('images.compress.quality', 85)
  const [error, setError] = useState<string | null>(null)
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'images.compress',
  )

  const compressImage = async (imageFile: typeof selectedFile) => {
    if (!imageFile) {
      console.warn('🖼️ CompressTool: No file selected')
      return
    }

    console.log('🖼️ CompressTool: Starting image compression', {
      fileName: imageFile.name,
      quality,
    })

    const operation = beginOperation()
    setError(null)

    try {
      const options: ImageCompressOptions = {
        quality,
      }

      console.log(
        '🖼️ CompressTool: Calling ImageMagick compress with options',
        options,
      )
      const blob = await imageMagickProcessor.compressImage(imageFile, options)
      if (!operation.isCurrent()) return
      console.log('🖼️ CompressTool: Compression completed', {
        originalSize: imageFile.size,
        newSize: blob.size,
        compressionRatio:
          (((imageFile.size - blob.size) / imageFile.size) * 100).toFixed(1) +
          '%',
      })

      const filename = `compressed_${imageFile.name}`
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

      console.log('🖼️ CompressTool: Compression successful - file downloaded')
    } catch (error) {
      if (!operation.isCurrent()) return
      console.error('🖼️ CompressTool: Error during compression:', error)
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
                onClick={() => setQuality(Number(value))}
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
              onChange={(e) => setQuality(parseInt(e.target.value))}
              disabled={isProcessing}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Smaller file</span>
              <span>Better quality</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => void compressImage(selectedFile)}
              disabled={isProcessing || !selectedFile}
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
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
