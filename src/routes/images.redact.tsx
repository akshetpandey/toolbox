import { useFileOperation } from '@/contexts/FileOperation'
import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { ResultCard, useToolResult } from '@/components/ResultCard'
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
import { applyBlurRedaction } from '@/lib/redaction'
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
  const { selectedFile, clearSelectedFile } = useImageTools()
  const { isProcessing } = useProcessing()
  const beginOperation = useFileOperation(selectedFile?.file)

  // Redaction settings
  const [redactionMode, setRedactionMode] = useWorkspaceState<
    'box' | 'blur' | 'pixelate' | 'emoji'
  >('images.redact.mode', 'box')
  const [redactionColor, setRedactionColor] = useWorkspaceState(
    'images.redact.color',
    '#000000',
  )
  const [blurRadius, setBlurRadius] = useWorkspaceState(
    'images.redact.blur',
    10,
  )
  const [pixelSize, setPixelSize] = useWorkspaceState(
    'images.redact.pixel-size',
    10,
  )
  const [selectedEmoji, setSelectedEmoji] = useWorkspaceState(
    'images.redact.emoji',
    '\u{1F600}',
  )
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
  const [redactionAreas, setRedactionAreas] = useWorkspaceState<
    RedactionArea[]
  >('images.redact.areas', [])
  const [redactionSource, setRedactionSource] = useWorkspaceState<File | null>(
    'images.redact.source',
    null,
  )
  const { result, setResult } = useToolResult(
    selectedFile?.file,
    'images.redact',
  )
  const [scaleFactor, setScaleFactor] = useState({ x: 1, y: 1 })
  const [isStrippingMetadata, setIsStrippingMetadata] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
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

    let cancelled = false
    img.onload = () => {
      if (cancelled) return
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
          applyBlurRedaction(ctx, area, area.blurRadius ?? 10)
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
    return () => {
      cancelled = true
    }
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
    const source = selectedFile?.file ?? null
    if (redactionSource === source) return
    setRedactionSource(source)
    setRedactionAreas([])
    setCurrentArea(null)
    setSelectedIndex(null)
    setResizeState(null)
    setDragState(null)
    setDownloadError(null)
    setIsStrippingMetadata(false)
  }, [selectedFile, redactionSource, setRedactionSource, setRedactionAreas])

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
          applyBlurRedaction(ctx, newRedactionArea, blurRadius)
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
        const scaledBlurRadius =
          (area.blurRadius ?? 10) * Math.max(scaleFactor.x, scaleFactor.y)
        applyBlurRedaction(
          outputCtx,
          { x: scaledX, y: scaledY, width: scaledWidth, height: scaledHeight },
          scaledBlurRadius,
        )
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

    const operation = beginOperation()
    setDownloadError(null)

    try {
      const blob = await createRedactedImageBlob()
      if (!operation.isCurrent()) return
      const filename = `redacted_${selectedFile.name.replace(/\.[^/.]+$/, '')}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`
      setResult({
        blob,
        filename,
        sourceSize: selectedFile.size,
        details: [
          `${selectedFile.dimensions?.width} × ${selectedFile.dimensions?.height} px`,
          `${redactionAreas.length} redaction areas`,
        ],
      })
      downloadBlob(blob, filename)
    } catch (error) {
      if (!operation.isCurrent()) return
      console.error('RedactionTool: Error during download:', error)
      setDownloadError(
        'Failed to redact the image. No file was downloaded. Please try again.',
      )
    } finally {
      operation.finish()
    }
  }

  const downloadRedactedImageWithMetadataStripped = async () => {
    if (!selectedFile) return

    const operation = beginOperation()
    setIsStrippingMetadata(true)
    setDownloadError(null)

    try {
      const redactedBlob = await createRedactedImageBlob()
      if (!operation.isCurrent()) return

      const redactedFile = new File(
        [redactedBlob],
        `redacted_${selectedFile.name}`,
        { type: redactedBlob.type },
      )

      const strippedBlob = await stripFileMetadata(redactedFile)
      if (!operation.isCurrent()) return
      const filename = `redacted_no-metadata_${selectedFile.name.replace(/\.[^/.]+$/, '')}.${strippedBlob.type === 'image/jpeg' ? 'jpg' : strippedBlob.type === 'image/webp' ? 'webp' : 'png'}`
      setResult({
        blob: strippedBlob,
        filename,
        sourceSize: selectedFile.size,
        details: [
          `${selectedFile.dimensions?.width} × ${selectedFile.dimensions?.height} px`,
          'Redacted image with embedded metadata removed; color profile retained.',
        ],
      })
      downloadBlob(strippedBlob, filename)
    } catch (error) {
      if (!operation.isCurrent()) return
      console.error(
        'RedactionTool: Error during download with metadata stripping:',
        error,
      )
      setDownloadError(
        'Failed to strip metadata from the redacted image. No file was downloaded. Please try again.',
      )
    } finally {
      operation.finish()
      if (operation.isCurrent()) setIsStrippingMetadata(false)
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
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="p-4 sm:p-6 flex min-w-0 flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <Label className="text-sm font-medium">Redaction mode</Label>
              <div
                role="group"
                aria-label="Redaction mode"
                className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
              >
                <button
                  type="button"
                  onClick={() => setRedactionMode('box')}
                  aria-pressed={redactionMode === 'box'}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 min-h-11 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
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
                  aria-pressed={redactionMode === 'blur'}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 min-h-11 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
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
                  aria-pressed={redactionMode === 'pixelate'}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 min-h-11 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
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
                  aria-pressed={redactionMode === 'emoji'}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 min-h-11 justify-center px-3 py-2 rounded-md text-sm font-medium transition-all ${
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
                <Label
                  htmlFor="redaction-color"
                  className="text-sm font-medium"
                >
                  Color:
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="redaction-color"
                    type="color"
                    value={redactionColor}
                    onChange={(event) => setRedactionColor(event.target.value)}
                    className="h-11 w-11 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
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
                <div className="flex min-w-0 flex-1 items-center gap-3">
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
                <div className="flex min-w-0 flex-1 items-center gap-3">
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
              <div className="relative flex flex-wrap items-center gap-3">
                <Label className="text-sm font-medium">Emoji:</Label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((v) => !v)}
                  aria-label="Choose redaction emoji"
                  aria-expanded={showEmojiPicker}
                  className="w-11 h-11 text-2xl rounded-lg border-2 border-border/50 hover:border-border transition-colors flex items-center justify-center bg-background"
                >
                  {selectedEmoji}
                </button>
                {showEmojiPicker && (
                  <div className="fixed inset-x-4 top-1/4 z-50 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-80">
                    <EmojiPicker
                      emojiStyle="native"
                      onEmojiClick={(emojiData: EmojiClickData) => {
                        setSelectedEmoji(emojiData.emoji)
                        setShowEmojiPicker(false)
                      }}
                      width="100%"
                      height={400}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={isProcessing}
              onClick={() => {
                const canvas = canvasRef.current
                if (!canvas) return
                const area: RedactionArea = {
                  x: Math.round(canvas.width / 3),
                  y: Math.round(canvas.height / 3),
                  width: Math.max(10, Math.round(canvas.width / 3)),
                  height: Math.max(10, Math.round(canvas.height / 3)),
                  mode: redactionMode,
                  color: redactionColor,
                  blurRadius,
                  pixelSize,
                  emoji: selectedEmoji,
                }
                setSelectedIndex(redactionAreas.length)
                setRedactionAreas((previous) => [...previous, area])
              }}
            >
              Add area
            </Button>
            <p className="text-sm text-muted-foreground">
              Draw over the image, or add an area and adjust its bounds below.
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border bg-muted/20 p-2 sm:p-4 flex justify-center">
            <canvas
              ref={canvasRef}
              aria-label="Image redaction canvas"
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

          {redactionAreas.length > 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Redaction areas"
            >
              {redactionAreas.map((area, index) => (
                <Button
                  key={index}
                  variant={selectedIndex === index ? 'default' : 'outline'}
                  aria-pressed={selectedIndex === index}
                  onClick={() => setSelectedIndex(index)}
                >
                  Area {index + 1} · {area.mode}
                </Button>
              ))}
            </div>
          )}
          {selectedIndex !== null && redactionAreas[selectedIndex] && (
            <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <legend className="mb-2 text-sm font-medium">
                Selected area bounds (preview pixels)
              </legend>
              {(['x', 'y', 'width', 'height'] as const).map((field) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={`area-${field}`}>
                    {field === 'x'
                      ? 'Left'
                      : field === 'y'
                        ? 'Top'
                        : field === 'width'
                          ? 'Width'
                          : 'Height'}
                  </Label>
                  <input
                    id={`area-${field}`}
                    type="number"
                    min={field === 'width' || field === 'height' ? 10 : 0}
                    value={Math.round(redactionAreas[selectedIndex][field])}
                    className="h-11 min-w-0 w-full rounded-md border bg-background px-3 text-base"
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      if (!Number.isFinite(value)) return
                      setRedactionAreas((previous) =>
                        previous.map((area, index) =>
                          index === selectedIndex
                            ? {
                                ...area,
                                [field]: Math.max(
                                  field === 'width' || field === 'height'
                                    ? 10
                                    : 0,
                                  value,
                                ),
                              }
                            : area,
                        ),
                      )
                    }}
                  />
                </div>
              ))}
            </fieldset>
          )}
          {selectedIndex !== null && (
            <p className="text-xs text-muted-foreground text-center">
              Drag to move. Drag handles to resize. Delete to remove. Escape to
              deselect.
            </p>
          )}

          {downloadError && (
            <p role="alert" className="text-sm text-destructive">
              {downloadError}
            </p>
          )}

          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:flex-wrap xl:justify-between">
            <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void downloadRedactedImage()}
                disabled={isProcessing || redactionAreas.length === 0}
                className="min-w-0 flex-1 sm:flex-none"
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
                className="min-w-0 h-auto min-h-11 whitespace-normal flex-1 sm:flex-none"
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
      <ResultCard result={result} onReset={clearSelectedFile} />
    </div>
  )
}
