import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { type ResizeOptions } from '@/lib/imagemagick'
import { createObjectURL, revokeObjectURL, downloadFile } from '@/lib/shared'
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
  const { selectedFile, imageMagickProcessor } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [resizeWidth, setResizeWidth] = useState('')
  const [resizeHeight, setResizeHeight] = useState('')
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)

  const handleWidthChange = (value: string) => {
    setResizeWidth(value)

    if (maintainAspectRatio && selectedFile) {
      const originalDimensions = selectedFile.dimensions

      if (originalDimensions && value) {
        const aspectRatio = originalDimensions.width / originalDimensions.height
        const newHeight = Math.round(parseInt(value) / aspectRatio)
        setResizeHeight(newHeight.toString())
      }
    }
  }

  const handleHeightChange = (value: string) => {
    setResizeHeight(value)

    if (maintainAspectRatio && selectedFile) {
      const originalDimensions = selectedFile.dimensions

      if (originalDimensions && value) {
        const aspectRatio = originalDimensions.width / originalDimensions.height
        const newWidth = Math.round(parseInt(value) * aspectRatio)
        setResizeWidth(newWidth.toString())
      }
    }
  }

  const resizeImage = async (imageFile: typeof selectedFile) => {
    if (!imageFile || !resizeWidth || !resizeHeight) {
      console.warn(
        '🖼️ ResizeTool: Resize validation failed - missing dimensions',
      )
      alert('Please enter both width and height')
      return
    }

    console.log('🖼️ ResizeTool: Starting image resize operation', {
      fileName: imageFile.name,
      targetWidth: resizeWidth,
      targetHeight: resizeHeight,
      maintainAspectRatio,
    })

    setIsProcessing(true)

    try {
      const options: ResizeOptions = {
        width: parseInt(resizeWidth),
        height: parseInt(resizeHeight),
        maintainAspectRatio,
      }

      console.log(
        '🖼️ ResizeTool: Calling ImageMagick resize with options',
        options,
      )
      const blob = await imageMagickProcessor.resizeImage(imageFile, options)
      console.log('🖼️ ResizeTool: Resize operation completed', {
        originalSize: imageFile.size,
        newSize: blob.size,
      })

      const url = createObjectURL(blob)
      downloadFile(url, `resized_${imageFile.name}`)
      revokeObjectURL(url)

      console.log(
        '🖼️ ResizeTool: Resize operation successful - file downloaded',
      )
      setIsProcessing(false)
    } catch (error) {
      console.error('🖼️ ResizeTool: Error during resize operation:', error)
      setIsProcessing(false)
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="width" className="text-sm font-medium">
              Width (px)
            </Label>
            <Input
              id="width"
              type="number"
              value={resizeWidth}
              onChange={(e) => handleWidthChange(e.target.value)}
              placeholder="800"
              className="border-border/50"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="height" className="text-sm font-medium">
              Height (px)
            </Label>
            <Input
              id="height"
              type="number"
              value={resizeHeight}
              onChange={(e) => handleHeightChange(e.target.value)}
              placeholder="600"
              className="border-border/50"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="aspect-ratio"
            checked={maintainAspectRatio}
            onCheckedChange={(checked) =>
              setMaintainAspectRatio(checked as boolean)
            }
          />
          <Label
            htmlFor="aspect-ratio"
            className="text-sm font-medium cursor-pointer"
          >
            Keep aspect ratio
          </Label>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => void resizeImage(selectedFile)}
            disabled={
              isProcessing || !resizeWidth || !resizeHeight || !selectedFile
            }
            className="bg-purple-500 hover:bg-purple-600"
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
