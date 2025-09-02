import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { type ImageCompressOptions } from '@/lib/imagemagick'
import { createObjectURL, revokeObjectURL, downloadFile } from '@/lib/shared'
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
  const { selectedFile, imageMagickProcessor } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [quality, setQuality] = useState(85)

  const compressImage = async (imageFile: typeof selectedFile) => {
    if (!imageFile) {
      console.warn('🖼️ CompressTool: No file selected')
      return
    }

    console.log('🖼️ CompressTool: Starting image compression', {
      fileName: imageFile.name,
      quality,
    })

    setIsProcessing(true)

    try {
      const options: ImageCompressOptions = {
        quality,
      }

      console.log(
        '🖼️ CompressTool: Calling ImageMagick compress with options',
        options,
      )
      const blob = await imageMagickProcessor.compressImage(imageFile, options)
      console.log('🖼️ CompressTool: Compression completed', {
        originalSize: imageFile.size,
        newSize: blob.size,
        compressionRatio:
          (((imageFile.size - blob.size) / imageFile.size) * 100).toFixed(1) +
          '%',
      })

      const url = createObjectURL(blob)
      downloadFile(url, `compressed_${imageFile.name}`)
      revokeObjectURL(url)

      console.log('🖼️ CompressTool: Compression successful - file downloaded')
      setIsProcessing(false)
    } catch (error) {
      console.error('🖼️ CompressTool: Error during compression:', error)
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
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
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Smaller file</span>
            <span>Better quality</span>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => void compressImage(selectedFile)}
            disabled={isProcessing || !selectedFile}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
