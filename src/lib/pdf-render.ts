import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import { canvasBlob, zipPDFResults } from './pdf-edit'

const assetBase = '/pdf-engines/pdfjs/'
export const PDF_REDACTION_SCALE = 2.5

export async function openBrowserPDF(file: Blob): Promise<PDFDocumentProxy> {
  const { getDocument, GlobalWorkerOptions } =
    await import('pdfjs-dist/legacy/build/pdf.mjs')
  GlobalWorkerOptions.workerSrc = `${assetBase}pdf.worker.min.mjs`
  const data = await file.arrayBuffer()
  const task = getDocument({
    data,
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    iccUrl: `${assetBase}iccs/`,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    wasmUrl: `${assetBase}wasm/`,
    enableXfa: false,
    stopAtErrors: true,
  })
  try {
    return await task.promise
  } catch (error) {
    await task.destroy()
    throw error
  }
}

export async function renderPDFPage(
  page: PDFPageProxy,
  preferredScale: number,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted()
  const dimensions = page.getViewport({ scale: 1 })
  if (
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  )
    throw new Error('This PDF contains a page with invalid dimensions.')

  const scale = Math.min(
    preferredScale,
    4096 / Math.max(dimensions.width, dimensions.height),
    Math.sqrt(12_000_000 / (dimensions.width * dimensions.height)),
  )
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(viewport.width))
  canvas.height = Math.max(1, Math.ceil(viewport.height))
  const canvasContext = canvas.getContext('2d', { alpha: false })
  if (!canvasContext) throw new Error('PDF rendering is unavailable.')
  const rendering = page.render({
    canvas,
    canvasContext,
    viewport,
    background: '#ffffff',
  })
  const cancel = () => rendering.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await rendering.promise
    signal?.throwIfAborted()
    return { canvas, width: dimensions.width, height: dimensions.height }
  } catch (error) {
    canvas.width = 0
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
    page.cleanup()
  }
}

export async function exportPDFImages(
  file: Blob,
  pages: number[],
  format: 'jpg' | 'png',
  scale: number,
  signal: AbortSignal,
  onPage: (index: number) => void,
) {
  const document = await openBrowserPDF(file)
  const type = format === 'jpg' ? 'image/jpeg' : 'image/png'
  try {
    const files: Record<string, Uint8Array> = {}
    for (const [index, page] of pages.entries()) {
      signal.throwIfAborted()
      const { canvas } = await renderPDFPage(
        await document.getPage(page + 1),
        scale,
        signal,
      )
      try {
        const blob = await canvasBlob(canvas, type, 0.9)
        if (pages.length === 1) return blob
        const number = String(index + 1).padStart(3, '0')
        files[`${number}-page-${page + 1}.${format}`] = new Uint8Array(
          await blob.arrayBuffer(),
        )
        onPage(index + 1)
      } finally {
        canvas.width = 0
      }
    }
    signal.throwIfAborted()
    return zipPDFResults(files)
  } finally {
    await document.loadingTask.destroy()
  }
}
