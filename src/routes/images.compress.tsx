import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'
import {
  type ImageCompressOptions,
  createObjectURL,
  revokeObjectURL,
  downloadFile,
} from '@/lib/imagemagick'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

export const Route = createFileRoute('/images/compress')({
  component: CompressPage,
})

function CompressPage() {
  const { selectedFile, imageMagickProcessor } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [quality, setQuality] = useState(85)
  const [progress, setProgress] = useState(0)

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
    setProgress(0)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 100)

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

      clearInterval(progressInterval)
      setProgress(100)
      console.log('🖼️ CompressTool: Compression successful - file downloaded')
      setTimeout(() => {
        setIsProcessing(false)
        setProgress(0)
      }, 500)
    } catch (error) {
      console.error('🖼️ CompressTool: Error during compression:', error)
      clearInterval(progressInterval)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Label htmlFor="quality" className="text-sm font-medium">
            Quality: {quality}%
          </Label>
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

        {progress > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>Compressing...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full h-2" />
          </div>
        )}

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
