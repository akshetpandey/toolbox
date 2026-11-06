import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { canvasBlob } from '@/lib/pdf-edit'
import { openBrowserPDF, renderPDFPage } from '@/lib/pdf-render'

type WatchThumbnail = (
  index: number,
  element: HTMLElement,
  onReady: (preview: Blob | null) => void,
) => () => void

export function usePDFThumbnails(file: File | undefined) {
  const [session, setSession] = useState<{
    file: File
    watch: WatchThumbnail
  }>()

  useEffect(() => {
    if (!file) {
      setSession(undefined)
      return
    }
    const lifetime = new AbortController()
    let pdf: ReturnType<typeof openBrowserPDF> | undefined
    let queue = Promise.resolve()
    const listeners = new Map<Element, (visible: boolean) => void>()
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries)
        listeners.get(entry.target)?.(entry.isIntersecting)
    })

    const watch: WatchThumbnail = (index, element, onReady) => {
      const row = new AbortController()
      const signal = AbortSignal.any([row.signal, lifetime.signal])
      let visible = false
      let queued = false
      const unwatch = () => {
        observer.unobserve(element)
        listeners.delete(element)
      }
      listeners.set(element, (isVisible) => {
        visible = isVisible
        if (!visible || queued) return
        queued = true
        // Render one visible page at a time, even for image-heavy documents.
        queue = queue.then(async () => {
          queued = false
          if (signal.aborted || !visible) return
          unwatch()
          try {
            const document = await (pdf ??= openBrowserPDF(file))
            signal.throwIfAborted()
            const page = await document.getPage(index + 1)
            const { canvas } = await renderPDFPage(page, 1, signal, 192)
            try {
              const blob = await canvasBlob(canvas, 'image/jpeg', 0.8)
              if (!signal.aborted) onReady(blob)
            } finally {
              canvas.width = 0
            }
          } catch {
            if (!signal.aborted) onReady(null)
          }
        })
      })
      observer.observe(element)
      return () => {
        row.abort()
        unwatch()
      }
    }
    setSession({ file, watch })
    return () => {
      lifetime.abort()
      observer.disconnect()
      void pdf
        ?.then((document) => document.loadingTask.destroy())
        .catch(() => undefined)
    }
  }, [file])

  return session?.file === file ? session?.watch : undefined
}

export function PDFPageThumbnail({
  index,
  rotation,
  watch,
}: {
  index: number
  rotation: number
  watch: WatchThumbnail | undefined
}) {
  const tile = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<{
    watch: WatchThumbnail
    url: string | null
  }>()
  useEffect(() => {
    setPreview(undefined)
    if (!tile.current || !watch) return
    let url: string | null = null
    const unwatch = watch(index, tile.current, (blob) => {
      url = blob && URL.createObjectURL(blob)
      setPreview({ watch, url })
    })
    return () => {
      unwatch()
      if (url) URL.revokeObjectURL(url)
    }
  }, [index, watch])
  const url = preview?.watch === watch ? preview?.url : undefined
  return (
    <div
      ref={tile}
      className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted p-1.5 sm:size-24"
    >
      {url ? (
        <img
          src={url}
          alt={`Preview of page ${index + 1}`}
          className="size-full min-h-0 min-w-0 object-contain"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      ) : url === null ? (
        <span className="text-center text-xs text-muted-foreground">
          Preview unavailable
        </span>
      ) : (
        <FileText aria-hidden="true" className="size-5 text-muted-foreground" />
      )}
    </div>
  )
}
