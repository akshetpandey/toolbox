import { canvasBlob, loadEditablePDF, savePDF } from './pdf-edit'
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
  if (areas.length === 0) throw new Error('Mark at least one area to redact.')
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
      throw new Error('One or more redaction areas are invalid.')

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
        if (!context) throw new Error('PDF rendering is unavailable.')
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

function abortable<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  message = 'OCR was stopped.',
) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error(message))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    void promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort))
  })
}

export async function makeSearchablePDF(
  file: Blob,
  signal: AbortSignal,
  onStatus: (message: string) => void,
) {
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const [
    original,
    {
      default: { createWorker, OEM, PSM },
    },
  ] = await Promise.all([
    loadEditablePDF(file),
    import('tesseract.js/dist/tesseract.esm.min.js'),
  ])
  const source = await openBrowserPDF(file)
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
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
      onStatus(`Recognizing page ${page} of ${source.numPages}…`)
      signal.throwIfAborted()
      if (!worker) {
        const assetBase = new URL('/pdf-engines/tesseract/', location.origin)
          .href
        const startupSignal = AbortSignal.any([
          signal,
          AbortSignal.timeout(30_000),
        ])
        const initialization = new Promise<
          Awaited<ReturnType<typeof createWorker>>
        >((resolve, reject) => {
          void createWorker('eng', OEM.LSTM_ONLY, {
            workerPath: `${assetBase}worker.min.js`,
            corePath: assetBase,
            langPath: assetBase,
            workerBlobURL: false,
            errorHandler: (cause: unknown) => {
              reject(
                new Error(
                  typeof cause === 'string'
                    ? cause
                    : 'Could not load the OCR engine.',
                ),
              )
            },
          }).then((instance) => {
            if (startupSignal.aborted) void instance.terminate()
            else resolve(instance)
          }, reject)
        })
        worker = await abortable(
          initialization,
          startupSignal,
          'The OCR engine took too long to load. Try again.',
        )
        await abortable(
          worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }),
          signal,
        )
      }
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
