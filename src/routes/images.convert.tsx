import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { type ImageConvertOptions } from '@/lib/imagemagick'
import { createObjectURL, revokeObjectURL, downloadFile } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/convert')({
  component: ConvertPage,
})

function ConvertPage() {
  const { selectedFile, imageMagickProcessor } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [targetFormat, setTargetFormat] = useState('webp')

  const convertImage = async (imageFile: typeof selectedFile) => {
    if (!imageFile) {
      console.warn('🖼️ ConvertTool: No file selected')
      return
    }

    console.log('🖼️ ConvertTool: Starting image conversion', {
      fileName: imageFile.name,
      targetFormat,
    })

    setIsProcessing(true)

    try {
      const options: ImageConvertOptions = {
        targetFormat,
      }

      console.log(
        '🖼️ ConvertTool: Calling ImageMagick convert with options',
        options,
      )
      const blob = await imageMagickProcessor.convertImage(imageFile, options)
      console.log('🖼️ ConvertTool: Conversion completed', {
        originalSize: imageFile.size,
        newSize: blob.size,
      })

      const url = createObjectURL(blob)
      downloadFile(url, `${imageFile.name.split('.')[0]}.${targetFormat}`)
      revokeObjectURL(url)

      console.log('🖼️ ConvertTool: Conversion successful - file downloaded')
      setIsProcessing(false)
    } catch (error) {
      console.error('🖼️ ConvertTool: Error during conversion:', error)
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium">Target Format</Label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="webp"
                name="format"
                value="webp"
                checked={targetFormat === 'webp'}
                onChange={(e) => setTargetFormat(e.target.value)}
                className="w-4 h-4 text-primary border-border/50"
              />
              <Label
                htmlFor="webp"
                className="text-sm font-normal cursor-pointer"
              >
                WebP (Recommended)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="png"
                name="format"
                value="png"
                checked={targetFormat === 'png'}
                onChange={(e) => setTargetFormat(e.target.value)}
                className="w-4 h-4 text-primary border-border/50"
              />
              <Label
                htmlFor="png"
                className="text-sm font-normal cursor-pointer"
              >
                PNG (Lossless)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="jpg"
                name="format"
                value="jpg"
                checked={targetFormat === 'jpg'}
                onChange={(e) => setTargetFormat(e.target.value)}
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

        <div className="flex justify-end">
          <Button
            onClick={() => void convertImage(selectedFile)}
            disabled={isProcessing || !selectedFile}
            className="bg-green-500 hover:bg-green-600"
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
