import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Square, Focus, Grid3x3 } from 'lucide-react'
import { downloadBlob } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

interface RedactionArea {
  x: number
  y: number
  width: number
  height: number
  mode: 'box' | 'blur' | 'pixelate'
  color?: string
  blurRadius?: number
  pixelSize?: number
}

export const Route = createFileRoute('/images/redact')({
  component: RedactPage,
})

function RedactPage() {
  const { selectedFile } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()

  // Redaction settings
  const [redactionMode, setRedactionMode] = useState<
    'box' | 'blur' | 'pixelate'
  >('box')
  const [redactionColor, setRedactionColor] = useState('#000000')
  const [blurRadius, setBlurRadius] = useState(10)
  const [pixelSize, setPixelSize] = useState(10)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingStart, setDrawingStart] = useState<{
    x: number
    y: number
  } | null>(null)
  const [currentArea, setCurrentArea] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([])
  const [scaleFactor, setScaleFactor] = useState({ x: 1, y: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Pixelate function
  const pixelateImageData = (
    imageData: ImageData,
    pixelSize: number,
  ): ImageData => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return imageData

    canvas.width = imageData.width
    canvas.height = imageData.height

    // Put original image data
    ctx.putImageData(imageData, 0, 0)

    // Scale down
    const smallCanvas = document.createElement('canvas')
    const smallCtx = smallCanvas.getContext('2d')
    if (!smallCtx) return imageData

    smallCanvas.width = Math.max(1, Math.floor(imageData.width / pixelSize))
    smallCanvas.height = Math.max(1, Math.floor(imageData.height / pixelSize))

    smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height)

    // Scale back up with pixelated effect
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(smallCanvas, 0, 0, imageData.width, imageData.height)

    return ctx.getImageData(0, 0, imageData.width, imageData.height)
  }

  // Canvas setup and drawing
  useEffect(() => {
    if (!canvasRef.current || !selectedFile) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()

    img.onload = () => {
      // Set canvas size to match image aspect ratio
      const maxWidth = 800
      const maxHeight = 600
      let { width, height } = img
      const originalWidth = img.width
      const originalHeight = img.height

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      // Calculate scale factor between display canvas and original image
      setScaleFactor({
        x: originalWidth / width,
        y: originalHeight / height,
      })

      // Clear canvas and draw image
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, width, height)

      // Store reference to original image for redaction operations
      originalImageRef.current = img

      // Redraw all existing redaction areas
      redactionAreas.forEach((area) => {
        if (area.mode === 'box') {
          ctx.fillStyle = area.color ?? '#000000'
          ctx.fillRect(area.x, area.y, area.width, area.height)
        } else if (area.mode === 'blur') {
          // For blur, we need to apply the blur effect
          const imageData = ctx.getImageData(
            area.x,
            area.y,
            area.width,
            area.height,
          )
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            tempCanvas.width = area.width
            tempCanvas.height = area.height
            tempCtx.putImageData(imageData, 0, 0)

            ctx.save()
            ctx.filter = `blur(${area.blurRadius ?? 10}px)`
            ctx.drawImage(tempCanvas, area.x, area.y)
            ctx.restore()
          }
        } else if (area.mode === 'pixelate') {
          // For pixelate, apply pixelation effect
          const imageData = ctx.getImageData(
            area.x,
            area.y,
            area.width,
            area.height,
          )
          const pixelatedData = pixelateImageData(
            imageData,
            area.pixelSize ?? 10,
          )
          ctx.putImageData(pixelatedData, area.x, area.y)
        }
      })

      // Draw current drawing area preview
      if (currentArea) {
        ctx.strokeStyle = redactionMode === 'box' ? redactionColor : 'blue'
        ctx.lineWidth = 2
        ctx.strokeRect(
          currentArea.x,
          currentArea.y,
          currentArea.width,
          currentArea.height,
        )

        if (redactionMode === 'box') {
          ctx.fillStyle = redactionColor + '40' // Semi-transparent
          ctx.fillRect(
            currentArea.x,
            currentArea.y,
            currentArea.width,
            currentArea.height,
          )
        }
      }
    }

    img.src = selectedFile.preview
  }, [
    selectedFile,
    currentArea,
    redactionMode,
    redactionColor,
    redactionAreas,
    blurRadius,
    pixelSize,
  ])

  // Reset redaction areas when file changes
  useEffect(() => {
    setRedactionAreas([])
    setCurrentArea(null)
  }, [selectedFile])

  // Prevent document scrolling when drawing
  useEffect(() => {
    if (isDrawing) {
      const preventScroll = (e: TouchEvent) => {
        e.preventDefault()
      }

      const preventScrollWheel = (e: WheelEvent) => {
        e.preventDefault()
      }

      document.body.style.overflow = 'hidden'
      document.addEventListener('touchmove', preventScroll, { passive: false })
      document.addEventListener('wheel', preventScrollWheel, { passive: false })

      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('touchmove', preventScroll)
        document.removeEventListener('wheel', preventScrollWheel)
      }
    }
  }, [isDrawing])

  // Canvas drawing handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvas = canvasRef.current

    // Calculate the scale factor between displayed canvas and actual canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    setIsDrawing(true)
    setDrawingStart({ x, y })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingStart || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const canvas = canvasRef.current

    // Calculate the scale factor between displayed canvas and actual canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const width = Math.abs(x - drawingStart.x)
    const height = Math.abs(y - drawingStart.y)
    const startX = Math.min(x, drawingStart.x)
    const startY = Math.min(y, drawingStart.y)

    setCurrentArea({ x: startX, y: startY, width, height })
  }

  const handleCanvasMouseUp = () => {
    if (!isDrawing || !drawingStart || !currentArea || !canvasRef.current)
      return

    if (currentArea.width > 5 && currentArea.height > 5) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (ctx) {
        // Store redaction area for high-quality download
        const newRedactionArea: RedactionArea = {
          x: Math.round(currentArea.x),
          y: Math.round(currentArea.y),
          width: Math.round(currentArea.width),
          height: Math.round(currentArea.height),
          mode: redactionMode,
          color: redactionMode === 'box' ? redactionColor : undefined,
          blurRadius: redactionMode === 'blur' ? blurRadius : undefined,
          pixelSize: redactionMode === 'pixelate' ? pixelSize : undefined,
        }

        setRedactionAreas((prev) => [...prev, newRedactionArea])

        if (redactionMode === 'box') {
          // Apply redaction box immediately
          ctx.fillStyle = redactionColor
          ctx.fillRect(
            Math.round(currentArea.x),
            Math.round(currentArea.y),
            Math.round(currentArea.width),
            Math.round(currentArea.height),
          )
          console.log('🖼️ Applied redaction box immediately')
        } else if (redactionMode === 'blur') {
          // Apply blur immediately
          const imageData = ctx.getImageData(
            Math.round(currentArea.x),
            Math.round(currentArea.y),
            Math.round(currentArea.width),
            Math.round(currentArea.height),
          )

          // Create temporary canvas for blur effect
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            tempCanvas.width = Math.round(currentArea.width)
            tempCanvas.height = Math.round(currentArea.height)
            tempCtx.putImageData(imageData, 0, 0)

            // Apply blur using canvas filter
            ctx.save()
            ctx.filter = `blur(${blurRadius}px)`
            ctx.drawImage(
              tempCanvas,
              Math.round(currentArea.x),
              Math.round(currentArea.y),
            )
            ctx.restore()
            console.log('🖼️ Applied blur immediately')
          }
        } else if (redactionMode === 'pixelate') {
          // Apply pixelate effect immediately
          const imageData = ctx.getImageData(
            Math.round(currentArea.x),
            Math.round(currentArea.y),
            Math.round(currentArea.width),
            Math.round(currentArea.height),
          )

          const pixelatedData = pixelateImageData(imageData, pixelSize)
          ctx.putImageData(
            pixelatedData,
            Math.round(currentArea.x),
            Math.round(currentArea.y),
          )
          console.log('🖼️ Applied pixelate immediately')
        }
      }
    }

    setIsDrawing(false)
    setDrawingStart(null)
    setCurrentArea(null)
  }

  // Touch event handlers for mobile support
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault() // Prevent scrolling
    e.stopPropagation() // Stop event bubbling
    if (!canvasRef.current || e.touches.length !== 1) return

    const touch = e.touches[0]
    const rect = canvasRef.current.getBoundingClientRect()
    const canvas = canvasRef.current

    // Calculate the scale factor between displayed canvas and actual canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    setIsDrawing(true)
    setDrawingStart({ x, y })
  }

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault() // Prevent scrolling
    e.stopPropagation() // Stop event bubbling
    if (
      !isDrawing ||
      !drawingStart ||
      !canvasRef.current ||
      e.touches.length !== 1
    )
      return

    const touch = e.touches[0]
    const rect = canvasRef.current.getBoundingClientRect()
    const canvas = canvasRef.current

    // Calculate the scale factor between displayed canvas and actual canvas
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    const width = Math.abs(x - drawingStart.x)
    const height = Math.abs(y - drawingStart.y)
    const startX = Math.min(x, drawingStart.x)
    const startY = Math.min(y, drawingStart.y)

    setCurrentArea({ x: startX, y: startY, width, height })
  }

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault() // Prevent scrolling
    e.stopPropagation() // Stop event bubbling
    handleCanvasMouseUp() // Reuse the same logic as mouse up
  }

  const downloadRedactedImage = async () => {
    if (!selectedFile || !originalImageRef.current) return

    console.log('🖼️ RedactionTool: Starting image download', {
      fileName: selectedFile.name,
      redactionCount: redactionAreas.length,
    })

    setIsProcessing(true)

    try {
      // Create full-resolution canvas with original image
      const originalWidth =
        selectedFile.dimensions?.width ?? originalImageRef.current.width
      const originalHeight =
        selectedFile.dimensions?.height ?? originalImageRef.current.height

      const outputCanvas = document.createElement('canvas')
      const outputCtx = outputCanvas.getContext('2d')
      if (!outputCtx) {
        throw new Error('Could not create output canvas context')
      }

      // Set output canvas to original image size
      outputCanvas.width = originalWidth
      outputCanvas.height = originalHeight

      // Draw original image at full resolution
      outputCtx.drawImage(
        originalImageRef.current,
        0,
        0,
        originalWidth,
        originalHeight,
      )

      // Apply all redactions at original scale
      for (const area of redactionAreas) {
        const scaledX = area.x * scaleFactor.x
        const scaledY = area.y * scaleFactor.y
        const scaledWidth = area.width * scaleFactor.x
        const scaledHeight = area.height * scaleFactor.y

        if (area.mode === 'box') {
          outputCtx.fillStyle = area.color ?? '#000000'
          outputCtx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight)
        } else if (area.mode === 'blur') {
          // For blur, get the image data and apply blur filter
          const imageData = outputCtx.getImageData(
            scaledX,
            scaledY,
            scaledWidth,
            scaledHeight,
          )
          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            tempCanvas.width = scaledWidth
            tempCanvas.height = scaledHeight
            tempCtx.putImageData(imageData, 0, 0)

            // Scale the blur radius to match the visual effect of the preview
            const scaledBlurRadius =
              (area.blurRadius ?? 10) * Math.max(scaleFactor.x, scaleFactor.y)

            outputCtx.save()
            outputCtx.filter = `blur(${scaledBlurRadius}px)`
            outputCtx.drawImage(tempCanvas, scaledX, scaledY)
            outputCtx.restore()
          }
        } else if (area.mode === 'pixelate') {
          // For pixelate, apply pixelation at preview scale then scale up
          // This maintains the exact same visual effect as the preview

          // Scale it down to preview resolution for pixelation
          const previewCanvas = document.createElement('canvas')
          const previewCtx = previewCanvas.getContext('2d')
          if (previewCtx) {
            previewCanvas.width = area.width
            previewCanvas.height = area.height

            // Draw the full-res area scaled down to preview size
            previewCtx.drawImage(
              outputCanvas,
              scaledX,
              scaledY,
              scaledWidth,
              scaledHeight,
              0,
              0,
              area.width,
              area.height,
            )

            // Apply pixelation at preview scale
            const previewAreaData = previewCtx.getImageData(
              0,
              0,
              area.width,
              area.height,
            )
            const pixelatedPreviewData = pixelateImageData(
              previewAreaData,
              area.pixelSize ?? 10,
            )
            previewCtx.putImageData(pixelatedPreviewData, 0, 0)

            // Scale it back up to full resolution
            outputCtx.drawImage(
              previewCanvas,
              0,
              0,
              area.width,
              area.height,
              scaledX,
              scaledY,
              scaledWidth,
              scaledHeight,
            )
          }
        }
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        outputCanvas.toBlob((resultBlob) => {
          if (resultBlob) {
            resolve(resultBlob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        }, 'image/png')
      })

      console.log('🖼️ RedactionTool: Download completed', {
        originalSize: selectedFile.size,
        newSize: blob.size,
      })

      downloadBlob(blob, `redacted_${selectedFile.name}`)

      console.log('🖼️ RedactionTool: Download successful')
    } catch (error) {
      console.error('🖼️ RedactionTool: Error during download:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearAllRedactions = useCallback(() => {
    // Reset canvas to original image
    if (canvasRef.current && originalImageRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(
          originalImageRef.current,
          0,
          0,
          canvas.width,
          canvas.height,
        )
        setRedactionAreas([])
      }
    }
    setCurrentArea(null)
  }, [])

  if (!selectedFile) {
    return (
      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-24">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Select an image to start redacting</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Mode:</Label>
            <div className="flex items-center bg-muted/50 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setRedactionMode('box')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  redactionMode === 'box'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Square className="w-3 h-3" />
                Box
              </button>
              <button
                type="button"
                onClick={() => setRedactionMode('blur')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  redactionMode === 'blur'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Focus className="w-3 h-3" />
                Blur
              </button>
              <button
                type="button"
                onClick={() => setRedactionMode('pixelate')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  redactionMode === 'pixelate'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Grid3x3 className="w-3 h-3" />
                Pixelate
              </button>
            </div>
          </div>

          {redactionMode === 'box' && (
            <div className="flex items-center gap-4">
              <Label htmlFor="redaction-color" className="text-sm font-medium">
                Color:
              </Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    id="redaction-color"
                    type="color"
                    value={redactionColor}
                    onChange={(e) => setRedactionColor(e.target.value)}
                    className="sr-only"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById('redaction-color')?.click()
                    }
                    className="w-8 h-8 rounded-lg border-2 border-border/50 hover:border-border transition-colors shadow-sm"
                    style={{ backgroundColor: redactionColor }}
                  />
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {redactionColor}
                </span>
              </div>
            </div>
          )}

          {redactionMode === 'blur' && (
            <div className="flex items-center gap-4">
              <Label htmlFor="blur-radius" className="text-sm font-medium">
                Blur:
              </Label>
              <div className="flex items-center gap-3 min-w-48">
                <input
                  id="blur-radius"
                  type="range"
                  min="1"
                  max="50"
                  value={blurRadius}
                  onChange={(e) => setBlurRadius(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-sm text-muted-foreground font-mono min-w-12">
                  {blurRadius}px
                </span>
              </div>
            </div>
          )}

          {redactionMode === 'pixelate' && (
            <div className="flex items-center gap-4">
              <Label htmlFor="pixel-size" className="text-sm font-medium">
                Pixel Size:
              </Label>
              <div className="flex items-center gap-3 min-w-48">
                <input
                  id="pixel-size"
                  type="range"
                  min="2"
                  max="50"
                  value={pixelSize}
                  onChange={(e) => setPixelSize(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                />
                <span className="text-sm text-muted-foreground font-mono min-w-12">
                  {pixelSize}px
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-2 border-dashed border-primary/20 rounded-lg p-4 bg-muted/20 flex justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[500px] border border-border/50 rounded cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          />
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={clearAllRedactions}
            disabled={redactionAreas.length === 0}
          >
            Clear All
          </Button>
          <Button
            onClick={() => void downloadRedactedImage()}
            disabled={isProcessing || redactionAreas.length === 0}
            className="bg-red-500 hover:bg-red-600"
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
