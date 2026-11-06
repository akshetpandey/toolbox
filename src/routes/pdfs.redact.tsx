import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { Button, Input, Label } from '@/components/ui'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { canvasBlob, pdfBaseName } from '@/lib/pdf-edit'
import {
  openBrowserPDF,
  PDF_REDACTION_SCALE,
  renderPDFPage,
} from '@/lib/pdf-render'
import type { PDFRedaction } from '@/lib/pdf-privacy'

export const Route = createFileRoute('/pdfs/redact')({
  component: PDFRedactRoute,
})

interface Point {
  x: number
  y: number
}

function areaFromPoints(page: number, start: Point, end: Point): PDFRedaction {
  return {
    page,
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  }
}

function pointerPosition(event: PointerEvent<HTMLDivElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
    y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
  }
}

function usePagePreview(file: File | undefined, page: number) {
  const [preview, setPreview] = useState<{
    file: File
    page: number
    url: string
  } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    const signal = controller.signal
    let url: string | undefined
    setError('')
    setPreview(null)
    void (async () => {
      try {
        const pdf = await openBrowserPDF(file)
        try {
          signal.throwIfAborted()
          const { canvas } = await renderPDFPage(
            await pdf.getPage(page),
            PDF_REDACTION_SCALE,
            signal,
          )
          try {
            const blob = await canvasBlob(canvas, 'image/png')
            signal.throwIfAborted()
            url = URL.createObjectURL(blob)
            setPreview({ file, page, url })
          } finally {
            canvas.width = 0
          }
        } finally {
          await pdf.loadingTask.destroy()
        }
      } catch (cause) {
        if (!signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'The page preview could not be loaded.',
          )
      }
    })()
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, page])
  return {
    url:
      preview && preview.file === file && preview.page === page
        ? preview.url
        : undefined,
    error,
  }
}

function PDFRedactRoute() {
  const { file, count, clearFiles } = usePDFSource()
  const [page, setPage] = useWorkspaceState('pdfs.edit.redact.page', 1)
  const [areas, setAreas] = useWorkspaceState<PDFRedaction[]>(
    'pdfs.edit.redact.areas',
    [],
  )
  const [draft, setDraft] = useState<PDFRedaction | null>(null)
  const gesture = useRef<{ pointer: number; start: Point } | null>(null)
  const { url, error } = usePagePreview(count ? file : undefined, page)
  const [coordinates, setCoordinates] = useState({
    x: '10',
    y: '10',
    width: '30',
    height: '10',
  })
  const x = Number(coordinates.x)
  const y = Number(coordinates.y)
  const width = Number(coordinates.width)
  const height = Number(coordinates.height)
  const validCoordinates =
    Object.values(coordinates).every(
      (value) => value.trim() !== '' && Number.isFinite(Number(value)),
    ) &&
    x >= 0 &&
    y >= 0 &&
    width > 0 &&
    height > 0 &&
    x + width <= 100 &&
    y + height <= 100

  function moveTo(next: number) {
    setDraft(null)
    gesture.current = null
    setPage(next)
  }

  const currentAreas = areas.filter((area) => area.page === page)
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, areas])}
      name="pdfs.edit.redact"
      label="Redact and download"
      status="Preparing your redacted PDF…"
      disabled={areas.length === 0 || !count}
      onReset={clearFiles}
      run={async (signal, setStatus) => {
        if (!file) throw new Error('Choose a PDF first.')
        const { redactPDF } = await import('@/lib/pdf-privacy')
        return {
          blob: await redactPDF(file, areas, signal, (index, total) => {
            setStatus(`Redacting page ${index} of ${total}…`)
          }),
          filename: `${pdfBaseName(file.name)}-redacted.pdf`,
          details: [
            `Covered ${areas.length} ${areas.length === 1 ? 'area' : 'areas'}. Check the downloaded PDF before sharing.`,
          ],
        }
      }}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Cover sensitive areas</h2>
        <p className="text-sm text-muted-foreground">
          Draw black boxes over everything you want to remove. The exported PDF
          contains only the new page images, with links, selectable text and
          form fields removed.
        </p>
      </div>
      {count === null && (
        <p role="alert" className="text-sm text-destructive">
          Choose a readable, unlocked PDF.
        </p>
      )}
      {count ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => moveTo(page - 1)}
            >
              Previous page
            </Button>
            <div className="flex items-center gap-2">
              <Label htmlFor="pdf-redact-page">Page</Label>
              <select
                id="pdf-redact-page"
                className="min-h-11 rounded-md border bg-background px-3"
                value={page}
                onChange={(event) => moveTo(Number(event.target.value))}
              >
                {Array.from({ length: count }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">of {count}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={page >= count}
              onClick={() => moveTo(page + 1)}
            >
              Next page
            </Button>
          </div>
          {error && (
            <p role="alert" className="break-words text-sm text-destructive">
              {error}
            </p>
          )}
          {!url && !error && (
            <p role="status" className="text-sm">
              Rendering page preview…
            </p>
          )}
          {url && (
            <div className="max-h-[65vh] overflow-auto rounded-md border bg-muted/30 p-2 text-center">
              <div
                className="relative inline-block max-w-full touch-none cursor-crosshair overflow-hidden align-top"
                onPointerDown={(event) => {
                  if (
                    !event.isPrimary ||
                    event.button !== 0 ||
                    event.currentTarget.closest('fieldset')?.disabled
                  )
                    return
                  event.currentTarget.setPointerCapture(event.pointerId)
                  gesture.current = {
                    pointer: event.pointerId,
                    start: pointerPosition(event),
                  }
                }}
                onPointerMove={(event) => {
                  if (gesture.current?.pointer === event.pointerId)
                    setDraft(
                      areaFromPoints(
                        page,
                        gesture.current.start,
                        pointerPosition(event),
                      ),
                    )
                }}
                onPointerUp={(event) => {
                  if (gesture.current?.pointer !== event.pointerId) return
                  const area = areaFromPoints(
                    page,
                    gesture.current.start,
                    pointerPosition(event),
                  )
                  gesture.current = null
                  setDraft(null)
                  if (area.width > 0.002 && area.height > 0.002)
                    setAreas([...areas, area])
                }}
                onPointerCancel={() => {
                  gesture.current = null
                  setDraft(null)
                }}
              >
                <img
                  src={url}
                  alt={`Preview of PDF page ${page}`}
                  draggable={false}
                  className="block h-auto max-w-full select-none"
                />
                {[...currentAreas, ...(draft ? [draft] : [])].map(
                  (area, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="pointer-events-none absolute bg-black"
                      style={{
                        left: `${area.x * 100}%`,
                        top: `${area.y * 100}%`,
                        width: `${area.width * 100}%`,
                        height: `${area.height * 100}%`,
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          )}
          <details className="space-y-3 rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Enter an exact area
            </summary>
            <p className="text-sm text-muted-foreground">
              Use percentages of this page, starting at the top left.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ['x', 'Left %'],
                  ['y', 'Top %'],
                  ['width', 'Width %'],
                  ['height', 'Height %'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`redact-position-${key}`}>{label}</Label>
                  <Input
                    id={`redact-position-${key}`}
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={coordinates[key]}
                    onChange={(event) =>
                      setCoordinates({
                        ...coordinates,
                        [key]: event.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!url || !validCoordinates}
              onClick={() =>
                setAreas([
                  ...areas,
                  {
                    page,
                    x: x / 100,
                    y: y / 100,
                    width: width / 100,
                    height: height / 100,
                  },
                ])
              }
            >
              Add redaction area
            </Button>
          </details>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {currentAreas.length} on this page · {areas.length} total
            </p>
            {currentAreas.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const last = areas.findLastIndex((area) => area.page === page)
                  setAreas(areas.filter((_, index) => index !== last))
                }}
              >
                Undo last area
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </PDFAction>
  )
}
