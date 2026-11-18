import { message } from '@/i18n/messages'
import type { LocalizedMessage } from '@/i18n/messages'
import { MessageError } from '@/i18n/MessageError'
import { canvasBlob, loadEditablePDF, savePDF } from './pdf-edit'
import { abortable, createOCRWorker } from './ocr'
import {
  openBrowserPDF,
  PDF_REDACTION_SCALE,
  renderPDFPage,
} from './pdf-render'

export interface PDFRedaction {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export async function redactPDF(
  file: Blob,
  areas: PDFRedaction[],
  signal: AbortSignal,
  onPage: (page: number, count: number) => void,
) {
  if (areas.length === 0)
    throw new MessageError('pdfPrivacyMarkAtLeastOneAreaTo')
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const source = await openBrowserPDF(file)
  try {
    if (
      areas.some(
        ({ page, x, y, width, height }) =>
          !Number.isInteger(page) ||
          page < 1 ||
          page > source.numPages ||
          ![x, y, width, height].every(Number.isFinite) ||
          x < 0 ||
          y < 0 ||
          width <= 0 ||
          height <= 0 ||
          x + width > 1.000001 ||
          y + height > 1.000001,
      )
    )
      throw new MessageError('pdfPrivacyOneOrMoreRedactionAreasAre')

    for (let page = 1; page <= source.numPages; page++) {
      signal.throwIfAborted()
      onPage(page, source.numPages)
      const { canvas, width, height } = await renderPDFPage(
        await source.getPage(page),
        PDF_REDACTION_SCALE,
        signal,
      )
      try {
        const context = canvas.getContext('2d')
        if (!context)
          throw new MessageError('pdfPrivacyPDFRenderingIsUnavailable')
        context.fillStyle = '#000'
        for (const area of areas) {
          if (area.page !== page) continue
          const left = Math.floor(area.x * canvas.width)
          const top = Math.floor(area.y * canvas.height)
          const right = Math.ceil((area.x + area.width) * canvas.width)
          const bottom = Math.ceil((area.y + area.height) * canvas.height)
          context.fillRect(left, top, right - left, bottom - top)
        }
        // Embed only the painted pixels into a new PDF. Original streams,
        // annotations, attachments, metadata and text cannot be recovered.
        const encoded = await canvasBlob(canvas, 'image/png')
        const image = await output.embedPng(await encoded.arrayBuffer())
        output
          .addPage([width, height])
          .drawImage(image, { x: 0, y: 0, width, height })
      } finally {
        canvas.width = 0
      }
    }
    signal.throwIfAborted()
    return savePDF(output)
  } finally {
    await source.loadingTask.destroy()
  }
}

export async function makeSearchablePDF(
  file: Blob,
  signal: AbortSignal,
  onStatus: (message: LocalizedMessage) => void,
) {
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const original = await loadEditablePDF(file)
  const source = await openBrowserPDF(file)
  let worker: Awaited<ReturnType<typeof createOCRWorker>> | undefined
  let recognized = 0
  try {
    for (let page = 1; page <= source.numPages; page++) {
      signal.throwIfAborted()
      const originalPage = await source.getPage(page)
      const existing = await originalPage.getTextContent()
      if (existing.items.some((item) => 'str' in item && item.str.trim())) {
        const [copy] = await output.copyPages(original, [page - 1])
        output.addPage(copy)
        continue
      }
      onStatus(
        message('pdfsOcrRecognizingPage', { page, total: source.numPages }),
      )
      signal.throwIfAborted()
      worker ??= await createOCRWorker(signal)
      signal.throwIfAborted()
      const { canvas, width, height } = await renderPDFPage(
        originalPage,
        3,
        signal,
      )
      try {
        const encoded = await canvasBlob(canvas, 'image/png')
        const { data } = await abortable(
          worker.recognize(
            encoded,
            { pdfTextOnly: true },
            { pdf: true, text: true },
          ),
          signal,
        )
        signal.throwIfAborted()
        if (!data.pdf || !data.text.trim()) {
          const [copy] = await output.copyPages(original, [page - 1])
          output.addPage(copy)
          continue
        }

        const textLayer = await PDFDocument.load(new Uint8Array(data.pdf))
        const [text] = await output.embedPdf(textLayer)
        const image = await output.embedPng(await encoded.arrayBuffer())
        const destination = output.addPage([width, height])
        destination.drawImage(image, { x: 0, y: 0, width, height })
        destination.drawPage(text, { x: 0, y: 0, width, height })
        recognized++
      } finally {
        canvas.width = 0
      }
    }
    signal.throwIfAborted()
    return { blob: recognized ? await savePDF(output) : file, recognized }
  } finally {
    await Promise.all([source.loadingTask.destroy(), worker?.terminate()])
  }
}
