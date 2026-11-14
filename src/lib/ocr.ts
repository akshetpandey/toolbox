import type { Worker } from 'tesseract.js'
import { canvasBlob } from './pdf-edit'

export function abortable<T>(
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

/** Use the same local OCR assets for images and scanned PDFs. */
export async function createOCRWorker(
  signal: AbortSignal,
  onStatus?: (message: string) => void,
): Promise<Worker> {
  signal.throwIfAborted()
  const {
    default: { createWorker, OEM, PSM },
  } = await import('tesseract.js/dist/tesseract.esm.min.js')
  signal.throwIfAborted()
  const assetBase = new URL('/pdf-engines/tesseract/', location.origin).href
  const startupSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  const initialization = new Promise<Worker>((resolve, reject) => {
    void createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: `${assetBase}worker.min.js`,
      corePath: assetBase,
      langPath: assetBase,
      workerBlobURL: false,
      logger: ({ status, progress }) => {
        if (!signal.aborted)
          onStatus?.(
            status === 'recognizing text'
              ? `Recognizing text… ${Math.round(progress * 100)}%`
              : 'Loading text recognition…',
          )
      },
      errorHandler: (cause: unknown) =>
        reject(
          new Error(
            typeof cause === 'string'
              ? cause
              : 'Could not load the OCR engine.',
          ),
        ),
    }).then((worker) => {
      if (startupSignal.aborted) void worker.terminate()
      else resolve(worker)
    }, reject)
  })
  const worker = await abortable(
    initialization,
    startupSignal,
    'The OCR engine took too long to load. Try again.',
  )
  try {
    await abortable(
      worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }),
      signal,
    )
    return worker
  } catch (error) {
    await worker.terminate()
    throw error
  }
}

export async function recognizeImageText(
  preview: string,
  signal: AbortSignal,
  onStatus: (message: string) => void,
) {
  signal.throwIfAborted()
  const image = new Image()
  image.src = preview
  await abortable(image.decode(), signal)
  signal.throwIfAborted()
  const scale = Math.min(
    1,
    6000 / Math.max(image.width, image.height),
    Math.sqrt(12_000_000 / (image.width * image.height)),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  let worker: Worker | undefined
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image rendering is unavailable.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasBlob(canvas, 'image/png')
    worker = await createOCRWorker(signal, onStatus)
    const { data } = await abortable(worker.recognize(blob), signal)
    signal.throwIfAborted()
    return data.text.trim()
  } finally {
    canvas.width = 0
    await worker?.terminate()
  }
}
