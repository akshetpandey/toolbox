import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Square,
  Focus,
  Grid3x3,
  Download,
  ShieldOff,
  Undo2,
  Smile,
} from 'lucide-react'
import { downloadBlob } from '@/lib/shared'
import { stripFileMetadata } from '@/lib/metadata'
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react'
import { useProcessing } from '@/contexts/ProcessingContext'
import { useImageTools } from '@/contexts/ImageToolsContext'

interface RedactionArea {
  x: number
  y: number
  width: number
  height: number
  mode: 'box' | 'blur' | 'pixelate' | 'emoji'
  color?: string
  blurRadius?: number
  pixelSize?: number
  emoji?: string
}

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLE_SIZE = 8
const MIN_AREA_SIZE = 10

const CURSOR_MAP: Record<HandleId, string> = {
  nw: 'nwse-resize',
  ne: 'nesw-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
}

function getHandlePositions(
  area: RedactionArea,
): Record<HandleId, { x: number; y: number }> {
  return {
    nw: { x: area.x, y: area.y },
    n: { x: area.x + area.width / 2, y: area.y },
    ne: { x: area.x + area.width, y: area.y },
    e: { x: area.x + area.width, y: area.y + area.height / 2 },
    se: { x: area.x + area.width, y: area.y + area.height },
    s: { x: area.x + area.width / 2, y: area.y + area.height },
    sw: { x: area.x, y: area.y + area.height },
    w: { x: area.x, y: area.y + area.height / 2 },
  }
}

function hitTestHandle(
  x: number,
  y: number,
  area: RedactionArea,
): HandleId | null {
  const handles = getHandlePositions(area)
  for (const [id, pos] of Object.entries(handles)) {
    if (
      Math.abs(x - pos.x) <= HANDLE_SIZE &&
      Math.abs(y - pos.y) <= HANDLE_SIZE
    ) {
      return id as HandleId
    }
  }
  return null
}

function hitTestArea(x: number, y: number, area: RedactionArea): boolean {
  return (
    x >= area.x &&
    x <= area.x + area.width &&
    y >= area.y &&
    y <= area.y + area.height
  )
}

function applyResize(
  area: RedactionArea,
  handle: HandleId,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = area

  if (handle === 'nw' || handle === 'w' || handle === 'sw') {
    x += dx
    width -= dx
  }
  if (handle === 'ne' || handle === 'e' || handle === 'se') {
    width += dx
  }
  if (handle === 'nw' || handle === 'n' || handle === 'ne') {
    y += dy
    height -= dy
  }
  if (handle === 'sw' || handle === 's' || handle === 'se') {
    height += dy
  }

  if (width < MIN_AREA_SIZE) {
    if (handle === 'nw' || handle === 'w' || handle === 'sw')
      x -= MIN_AREA_SIZE - width
    width = MIN_AREA_SIZE
  }
  if (height < MIN_AREA_SIZE) {
    if (handle === 'nw' || handle === 'n' || handle === 'ne')
      y -= MIN_AREA_SIZE - height
    height = MIN_AREA_SIZE
  }

  return { x, y, width, height }
}

// Pixelate function (pure, no component deps)
function pixelateImageData(imageData: ImageData, pixelSize: number): ImageData {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return imageData

  canvas.width = imageData.width
  canvas.height = imageData.height
  ctx.putImageData(imageData, 0, 0)

  const smallCanvas = document.createElement('canvas')
  const smallCtx = smallCanvas.getContext('2d')
  if (!smallCtx) return imageData

  smallCanvas.width = Math.max(1, Math.floor(imageData.width / pixelSize))
  smallCanvas.height = Math.max(1, Math.floor(imageData.height / pixelSize))
  smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(smallCanvas, 0, 0, imageData.width, imageData.height)

  return ctx.getImageData(0, 0, imageData.width, imageData.height)
}

export const Route = createFileRoute('/images/redact')({
  component: RedactPage,
  head: () => ({
    meta: [
      {
        title:
          'Image Redaction Tool - Free Browser-Based Privacy Protection | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based image redaction tool. Blur, pixelate, or blackout sensitive information in images. Process images entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'image redaction, blur sensitive info, pixelate images, privacy protection, browser image editor',
      },
      {
        property: 'og:title',
        content: 'Image Redaction Tool - Free Browser-Based Privacy Protection',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based image redaction. Protect sensitive information with blur, pixelate, or blackout effects.',
      },
    ],
  }),
})

function RedactPage() {
  const { selectedFile } = useImageTools()
  const { isProcessing, setIsProcessing } = useProcessing()

  // Redaction settings
  const [redactionMode, setRedactionMode] = useState<
    'box' | 'blur' | 'pixelate' | 'emoji'
  >('box')
  const [redactionColor, setRedactionColor] = useState('#000000')
  const [blurRadius, setBlurRadius] = useState(10)
  const [pixelSize, setPixelSize] = useState(10)
  const [selectedEmoji, setSelectedEmoji] = useState('\u{1F600}')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
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
  const [isStrippingMetadata, setIsStrippingMetadata] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // Selection & resize state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [resizeState, setResizeState] = useState<{
    index: number
    handle: HandleId
    startX: number
    startY: number
    originalArea: RedactionArea
  } | null>(null)
  const [dragState, setDragState] = useState<{
    index: number
    startX: number
    startY: number
    originalArea: RedactionArea
  } | null>(null)
  const [canvasCursor, setCanvasCursor] = useState('crosshair')

  // Helper to get canvas coordinates from client coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }, [])

  // Undo last redaction
  const undoLastRedaction = useCallback(() => {
    setRedactionAreas((prev) => {
      if (prev.length === 0) return prev
      return prev.slice(0, -1)
    })
    setSelectedIndex(null)
  }, [])

  // Canvas setup and drawing
  useEffect(() => {
    if (!canvasRef.current || !selectedFile) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()

    img.onload = () => {
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

      setScaleFactor({
        x: originalWidth / width,
        y: originalHeight / height,
      })

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, width, height)

      originalImageRef.current = img

      // Compute effective areas (applying resize in progress)
      const effectiveAreas = redactionAreas.map((area, i) => {
        if (resizeState?.index === i) {
          const dx =
            resizeState.startX !== undefined
              ? 0
              : 0 /* dx/dy come from mouse move */
          void dx
          return area // During resize, area is updated via setRedactionAreas
        }
        return area
      })

      // Redraw all redaction areas
      effectiveAreas.forEach((area) => {
        if (area.mode === 'box') {
          ctx.fillStyle = area.color ?? '#000000'
          ctx.fillRect(area.x, area.y, area.width, area.height)
        } else if (area.mode === 'blur') {
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
        } else if (area.mode === 'emoji') {
          const fontSize = Math.min(area.width, area.height) * 0.85
          if (fontSize > 2) {
            ctx.font = `${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#000000'
            ctx.fillText(
              area.emoji ?? '\u{1F600}',
              area.x + area.width / 2,
              area.y + area.height / 2,
            )
          }
        }
      })

      // Draw selection handles on selected redaction
      if (selectedIndex !== null && selectedIndex < effectiveAreas.length) {
        const sel = effectiveAreas[selectedIndex]
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(sel.x, sel.y, sel.width, sel.height)
        ctx.setLineDash([])

        const handles = getHandlePositions(sel)
        ctx.fillStyle = '#3b82f6'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        for (const pos of Object.values(handles)) {
          ctx.fillRect(
            pos.x - HANDLE_SIZE / 2,
            pos.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE,
          )
          ctx.strokeRect(
            pos.x - HANDLE_SIZE / 2,
            pos.y - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE,
          )
        }
      }

      // Draw current drawing area preview
      if (currentArea) {
        ctx.strokeStyle = redactionMode === 'box' ? redactionColor : '#3b82f6'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.strokeRect(
          currentArea.x,
          currentArea.y,
          currentArea.width,
          currentArea.height,
        )

        if (redactionMode === 'box') {
          ctx.fillStyle = redactionColor + '40'
          ctx.fillRect(
            currentArea.x,
            currentArea.y,
            currentArea.width,
            currentArea.height,
          )
        } else if (redactionMode === 'emoji') {
          const previewFontSize =
            Math.min(currentArea.width, currentArea.height) * 0.85
          if (previewFontSize > 8) {
            ctx.font = `${previewFontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#000000'
            ctx.fillText(
              selectedEmoji,
              currentArea.x + currentArea.width / 2,
              currentArea.y + currentArea.height / 2,
            )
          }
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
    selectedIndex,
    resizeState,
    selectedEmoji,
  ])

  // Reset redaction areas when file changes
  useEffect(() => {
    setRedactionAreas([])
    setCurrentArea(null)
    setSelectedIndex(null)
    setResizeState(null)
    setDragState(null)
  }, [selectedFile])

  // Prevent document scrolling when drawing or resizing
  useEffect(() => {
    if (isDrawing || resizeState || dragState) {
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
  }, [isDrawing, resizeState, dragState])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undoLastRedaction()
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedIndex !== null
      ) {
        // Don't capture if user is typing in an input
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return
        e.preventDefault()
        setRedactionAreas((prev) => prev.filter((_, i) => i !== selectedIndex))
        setSelectedIndex(null)
      }
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIndex, undoLastRedaction])

  // Canvas mouse handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setShowEmojiPicker(false)
    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (!coords) return

    // 1. Check resize handle on selected redaction
    if (selectedIndex !== null && selectedIndex < redactionAreas.length) {
      const handle = hitTestHandle(
        coords.x,
        coords.y,
        redactionAreas[selectedIndex],
      )
      if (handle) {
        setResizeState({
          index: selectedIndex,
          handle,
          startX: coords.x,
          startY: coords.y,
          originalArea: { ...redactionAreas[selectedIndex] },
        })
        return
      }
    }

    // 2. Check if clicking on any redaction (top-most first)
    for (let i = redactionAreas.length - 1; i >= 0; i--) {
      if (hitTestArea(coords.x, coords.y, redactionAreas[i])) {
        if (i === selectedIndex) {
          // Already selected - start dragging
          setDragState({
            index: i,
            startX: coords.x,
            startY: coords.y,
            originalArea: { ...redactionAreas[i] },
          })
        } else {
          setSelectedIndex(i)
        }
        return
      }
    }

    // 3. Empty space - deselect and start drawing
    setSelectedIndex(null)
    setIsDrawing(true)
    setDrawingStart(coords)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e.clientX, e.clientY)
    if (!coords) return

    // Resize in progress
    if (resizeState) {
      const dx = coords.x - resizeState.startX
      const dy = coords.y - resizeState.startY
      const newBounds = applyResize(
        resizeState.originalArea,
        resizeState.handle,
        dx,
        dy,
      )
      setRedactionAreas((prev) =>
        prev.map((area, i) =>
          i === resizeState.index ? { ...area, ...newBounds } : area,
        ),
      )
      return
    }

    // Drag in progress
    if (dragState) {
      const dx = coords.x - dragState.startX
      const dy = coords.y - dragState.startY
      setRedactionAreas((prev) =>
        prev.map((area, i) =>
          i === dragState.index
            ? {
                ...area,
                x: dragState.originalArea.x + dx,
                y: dragState.originalArea.y + dy,
              }
            : area,
        ),
      )
      return
    }

    // Drawing in progress
    if (isDrawing && drawingStart) {
      const width = Math.abs(coords.x - drawingStart.x)
      const height = Math.abs(coords.y - drawingStart.y)
      const startX = Math.min(coords.x, drawingStart.x)
      const startY = Math.min(coords.y, drawingStart.y)
      setCurrentArea({ x: startX, y: startY, width, height })
      return
    }

    // Cursor updates when idle
    if (selectedIndex !== null && selectedIndex < redactionAreas.length) {
      const handle = hitTestHandle(
        coords.x,
        coords.y,
        redactionAreas[selectedIndex],
      )
      if (handle) {
        setCanvasCursor(CURSOR_MAP[handle])
        return
      }
      if (hitTestArea(coords.x, coords.y, redactionAreas[selectedIndex])) {
        setCanvasCursor('grab')
        return
      }
    }
    for (let i = redactionAreas.length - 1; i >= 0; i--) {
      if (hitTestArea(coords.x, coords.y, redactionAreas[i])) {
        setCanvasCursor('pointer')
        return
      }
    }
    setCanvasCursor('crosshair')
  }

  const handleCanvasMouseUp = () => {
    // Finalize drag
    if (dragState) {
      setDragState(null)
      return
    }

    // Finalize resize
    if (resizeState) {
      setResizeState(null)
      return
    }

    // Finalize drawing
    if (!isDrawing || !drawingStart || !currentArea || !canvasRef.current) {
      setIsDrawing(false)
      setDrawingStart(null)
      setCurrentArea(null)
      return
    }

    if (currentArea.width > 5 && currentArea.height > 5) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      if (ctx) {
        const newRedactionArea: RedactionArea = {
          x: Math.round(currentArea.x),
          y: Math.round(currentArea.y),
          width: Math.round(currentArea.width),
          height: Math.round(currentArea.height),
          mode: redactionMode,
          color: redactionMode === 'box' ? redactionColor : undefined,
          blurRadius: redactionMode === 'blur' ? blurRadius : undefined,
          pixelSize: redactionMode === 'pixelate' ? pixelSize : undefined,
          emoji: redactionMode === 'emoji' ? selectedEmoji : undefined,
        }

        setRedactionAreas((prev) => [...prev, newRedactionArea])

        if (redactionMode === 'box') {
          ctx.fillStyle = redactionColor
          ctx.fillRect(
            Math.round(currentArea.x),
            Math.round(currentArea.y),
            Math.round(currentArea.width),
            Math.round(currentArea.height),
          )
        } else if (redactionMode === 'blur') {
          const imageData = ctx.getImageData(
            Math.round(currentArea.x),
            Math.round(currentArea.y),
            Math.round(currentArea.width),
            Math.round(currentArea.height),
          )

          const tempCanvas = document.createElement('canvas')
          const tempCtx = tempCanvas.getContext('2d')

          if (tempCtx) {
            tempCanvas.width = Math.round(currentArea.width)
            tempCanvas.height = Math.round(currentArea.height)
            tempCtx.putImageData(imageData, 0, 0)

            ctx.save()
            ctx.filter = `blur(${blurRadius}px)`
            ctx.drawImage(
              tempCanvas,
              Math.round(currentArea.x),
              Math.round(currentArea.y),
            )
            ctx.restore()
          }
        } else if (redactionMode === 'pixelate') {
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
        } else if (redactionMode === 'emoji') {
          const fontSize =
            Math.min(
              Math.round(currentArea.width),
              Math.round(currentArea.height),
            ) * 0.85
          if (fontSize > 2) {
            ctx.font = `${fontSize}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#000000'
            ctx.fillText(
              selectedEmoji,
              Math.round(currentArea.x) + Math.round(currentArea.width) / 2,
              Math.round(currentArea.y) + Math.round(currentArea.height) / 2,
            )
          }
        }
      }
    }

    setIsDrawing(false)
    setDrawingStart(null)
    setCurrentArea(null)
  }

  // Touch event handlers
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.touches.length !== 1) return

    const touch = e.touches[0]
    const coords = getCanvasCoords(touch.clientX, touch.clientY)
    if (!coords) return

    // Check resize handle
    if (selectedIndex !== null && selectedIndex < redactionAreas.length) {
      const handle = hitTestHandle(
        coords.x,
        coords.y,
        redactionAreas[selectedIndex],
      )
      if (handle) {
        setResizeState({
          index: selectedIndex,
          handle,
          startX: coords.x,
          startY: coords.y,
          originalArea: { ...redactionAreas[selectedIndex] },
        })
        return
      }
    }

    // Check area hit
    for (let i = redactionAreas.length - 1; i >= 0; i--) {
      if (hitTestArea(coords.x, coords.y, redactionAreas[i])) {
        if (i === selectedIndex) {
          setDragState({
            index: i,
            startX: coords.x,
            startY: coords.y,
            originalArea: { ...redactionAreas[i] },
          })
        } else {
          setSelectedIndex(i)
        }
        return
      }
    }

    // Start drawing
    setSelectedIndex(null)
    setIsDrawing(true)
    setDrawingStart(coords)
  }

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.touches.length !== 1) return

    const touch = e.touches[0]
    const coords = getCanvasCoords(touch.clientX, touch.clientY)
    if (!coords) return

    if (resizeState) {
      const dx = coords.x - resizeState.startX
      const dy = coords.y - resizeState.startY
      const newBounds = applyResize(
        resizeState.originalArea,
        resizeState.handle,
        dx,
        dy,
      )
      setRedactionAreas((prev) =>
        prev.map((area, i) =>
          i === resizeState.index ? { ...area, ...newBounds } : area,
        ),
      )
      return
    }

    if (dragState) {
      const dx = coords.x - dragState.startX
      const dy = coords.y - dragState.startY
      setRedactionAreas((prev) =>
        prev.map((area, i) =>
          i === dragState.index
            ? {
                ...area,
                x: dragState.originalArea.x + dx,
                y: dragState.originalArea.y + dy,
              }
            : area,
        ),
      )
      return
    }

    if (!isDrawing || !drawingStart) return

    const width = Math.abs(coords.x - drawingStart.x)
    const height = Math.abs(coords.y - drawingStart.y)
    const startX = Math.min(coords.x, drawingStart.x)
    const startY = Math.min(coords.y, drawingStart.y)
    setCurrentArea({ x: startX, y: startY, width, height })
  }

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.stopPropagation()
    handleCanvasMouseUp()
  }

  // Common function to create redacted image blob
  const createRedactedImageBlob = async (): Promise<Blob> => {
    if (!selectedFile || !originalImageRef.current) {
      throw new Error('No file selected or original image not available')
    }

    const originalWidth =
      selectedFile.dimensions?.width ?? originalImageRef.current.width
    const originalHeight =
      selectedFile.dimensions?.height ?? originalImageRef.current.height

    const outputCanvas = document.createElement('canvas')
    const outputCtx = outputCanvas.getContext('2d')
    if (!outputCtx) {
      throw new Error('Could not create output canvas context')
    }

    outputCanvas.width = originalWidth
    outputCanvas.height = originalHeight

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

          const scaledBlurRadius =
            (area.blurRadius ?? 10) * Math.max(scaleFactor.x, scaleFactor.y)

          outputCtx.save()
          outputCtx.filter = `blur(${scaledBlurRadius}px)`
          outputCtx.drawImage(tempCanvas, scaledX, scaledY)
          outputCtx.restore()
        }
      } else if (area.mode === 'pixelate') {
        const previewCanvas = document.createElement('canvas')
        const previewCtx = previewCanvas.getContext('2d')
        if (previewCtx) {
          previewCanvas.width = area.width
          previewCanvas.height = area.height

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
      } else if (area.mode === 'emoji') {
        const fontSize = Math.min(scaledWidth, scaledHeight) * 0.85
        if (fontSize > 2) {
          outputCtx.font = `${fontSize}px sans-serif`
          outputCtx.textAlign = 'center'
          outputCtx.textBaseline = 'middle'
          outputCtx.fillStyle = '#000000'
          outputCtx.fillText(
            area.emoji ?? '\u{1F600}',
            scaledX + scaledWidth / 2,
            scaledY + scaledHeight / 2,
          )
        }
      }
    }

    const mimeType =
      selectedFile.type.includes('jpeg') || selectedFile.type.includes('jpg')
        ? 'image/jpeg'
        : selectedFile.type.includes('webp')
          ? 'image/webp'
          : 'image/png'
    const quality = mimeType === 'image/png' ? undefined : 0.92

    return new Promise<Blob>((resolve, reject) => {
      outputCanvas.toBlob(
        (resultBlob) => {
          if (resultBlob) {
            resolve(resultBlob)
          } else {
            reject(new Error('Failed to create blob from canvas'))
          }
        },
        mimeType,
        quality,
      )
    })
  }

  const downloadRedactedImage = async () => {
    if (!selectedFile) return

    setIsProcessing(true)

    try {
      const blob = await createRedactedImageBlob()
      downloadBlob(blob, `redacted_${selectedFile.name}`)
    } catch (error) {
      console.error('RedactionTool: Error during download:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadRedactedImageWithMetadataStripped = async () => {
    if (!selectedFile) return

    setIsProcessing(true)
    setIsStrippingMetadata(true)

    try {
      const redactedBlob = await createRedactedImageBlob()

      const redactedFile = new File(
        [redactedBlob],
        `redacted_${selectedFile.name}`,
        { type: redactedBlob.type },
      )

      const strippedBlob = await stripFileMetadata(redactedFile)
      downloadBlob(strippedBlob, `redacted_no-metadata_${selectedFile.name}`)
    } catch (error) {
      console.error(
        'RedactionTool: Error during download with metadata stripping:',
        error,
      )
      alert(
        'Failed to download redacted image with metadata stripped. Please try again.',
      )
    } finally {
      setIsProcessing(false)
      setIsStrippingMetadata(false)
    }
  }

  const clearAllRedactions = useCallback(() => {
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
    setSelectedIndex(null)
    setResizeState(null)
    setDragState(null)
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
              <button
                type="button"
                onClick={() => setRedactionMode('emoji')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  redactionMode === 'emoji'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smile className="w-3 h-3" />
                Emoji
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

          {redactionMode === 'emoji' && (
            <div className="relative flex items-center gap-4">
              <Label className="text-sm font-medium">Emoji:</Label>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="w-10 h-10 text-2xl rounded-lg border-2 border-border/50 hover:border-border transition-colors flex items-center justify-center bg-background"
              >
                {selectedEmoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 z-50 mt-2">
                  <EmojiPicker
                    onEmojiClick={(emojiData: EmojiClickData) => {
                      setSelectedEmoji(emojiData.emoji)
                      setShowEmojiPicker(false)
                    }}
                    width={350}
                    height={400}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-2 border-dashed border-primary/20 rounded-lg p-4 bg-muted/20 flex justify-center">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-125 border border-border/50 rounded touch-none"
            style={{ touchAction: 'none', cursor: canvasCursor }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          />
        </div>

        {selectedIndex !== null && (
          <p className="text-xs text-muted-foreground text-center">
            Drag to move. Drag handles to resize. Delete to remove. Escape to
            deselect.
          </p>
        )}

        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={undoLastRedaction}
              disabled={redactionAreas.length === 0}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <Button
              variant="outline"
              onClick={clearAllRedactions}
              disabled={redactionAreas.length === 0}
            >
              Clear All
            </Button>
          </div>
          <div className="flex gap-2">
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
            <Button
              onClick={() => void downloadRedactedImageWithMetadataStripped()}
              disabled={isProcessing || redactionAreas.length === 0}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isStrippingMetadata ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
              <Download className="h-4 w-4" />
              {isStrippingMetadata
                ? 'Stripping...'
                : 'Download Without Metadata'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
