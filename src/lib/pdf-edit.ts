import type { PDFDocument } from 'pdf-lib'

export function pdfBaseName(filename: string) {
  return filename.replace(/\.[^.]+$/, '') || 'document'
}

export function parsePageRanges(value: string, pageCount: number): number[][] {
  if (!value.trim()) return [Array.from({ length: pageCount }, (_, i) => i)]
  return value.split(',').map((part) => {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(part)
    if (!match) throw new Error('Enter page numbers or ranges, such as 1-3, 5.')
    const first = Number(match[1])
    const last = Number(match[2] ?? first)
    if (first < 1 || last < first || last > pageCount)
      throw new Error(`Each page range must be between 1 and ${pageCount}.`)
    return Array.from({ length: last - first + 1 }, (_, i) => first + i - 1)
  })
}

export async function loadEditablePDF(file: Blob) {
  const { PDFDocument } = await import('pdf-lib')
  return PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
}

export async function savePDF(document: PDFDocument) {
  const data = await document.save({ addDefaultPage: false })
  return new Blob([data as Uint8Array<ArrayBuffer>], {
    type: 'application/pdf',
  })
}

export async function zipPDFResults(
  files: Record<string, Uint8Array>,
): Promise<Blob> {
  const { zip } = await import('fflate')
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (error, bytes) => {
      if (error) reject(error)
      else
        resolve(
          new Blob([bytes], {
            type: 'application/zip',
          }),
        )
    })
  })
}

export async function extractPDFPages(
  file: Blob,
  ranges: string,
  separate: boolean,
  signal: AbortSignal,
) {
  const { PDFDocument } = await import('pdf-lib')
  const source = await loadEditablePDF(file)
  const groups = parsePageRanges(ranges, source.getPageCount())
  const pages = groups.flat()
  if (pages.length === 0) throw new Error('This PDF has no pages.')
  if (!separate) {
    const output = await PDFDocument.create()
    const copied = await output.copyPages(source, pages)
    signal.throwIfAborted()
    copied.forEach((page) => output.addPage(page))
    return {
      blob: await savePDF(output),
      count: pages.length,
      extension: 'pdf',
    }
  }
  const files: Record<string, Uint8Array> = {}
  const selections = ranges.trim() ? groups : pages.map((page) => [page])
  for (const [index, selection] of selections.entries()) {
    signal.throwIfAborted()
    const output = await PDFDocument.create()
    const copied = await output.copyPages(source, selection)
    copied.forEach((page) => output.addPage(page))
    files[`part-${String(index + 1).padStart(3, '0')}.pdf`] =
      await output.save()
  }
  return {
    blob: await zipPDFResults(files),
    count: selections.length,
    extension: 'zip',
  }
}

export interface PDFPageEdit {
  index: number
  rotation: number
}

export async function organizePDF(file: Blob, edits: PDFPageEdit[]) {
  const { degrees, PDFDocument } = await import('pdf-lib')
  const source = await loadEditablePDF(file)
  const count = source.getPageCount()
  if (edits.length === 0) throw new Error('Keep at least one page.')
  if (
    new Set(edits.map((edit) => edit.index)).size !== edits.length ||
    edits.some(
      ({ index, rotation }) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= count ||
        rotation % 90 !== 0,
    )
  )
    throw new Error('The page selection is invalid.')
  const output = await PDFDocument.create()
  const copied = await output.copyPages(
    source,
    edits.map((edit) => edit.index),
  )
  copied.forEach((page, index) => {
    page.setRotation(
      degrees((page.getRotation().angle + edits[index].rotation) % 360),
    )
    output.addPage(page)
  })
  return savePDF(output)
}

export function canvasBlob(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob?.type === type
          ? resolve(blob)
          : reject(new Error('Image export failed.')),
      type,
      quality,
    )
  })
}

export async function imagesToPDF(
  images: File[],
  layout: 'photo' | 'a4' | 'letter',
  signal: AbortSignal,
) {
  const { PDFDocument, PageSizes } = await import('pdf-lib')
  const document = await PDFDocument.create()
  for (const file of images) {
    signal.throwIfAborted()
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error(`Could not open ${file.name} as a JPG or PNG image.`)
    })
    const canvas = window.document.createElement('canvas')
    try {
      const scale = Math.min(
        1,
        4096 / Math.max(bitmap.width, bitmap.height),
        Math.sqrt(12_000_000 / (bitmap.width * bitmap.height)),
      )
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Image rendering is unavailable.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const jpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
      const encoded = await canvasBlob(
        canvas,
        jpeg ? 'image/jpeg' : 'image/png',
        0.94,
      )
      const data = await encoded.arrayBuffer()
      const image = jpeg
        ? await document.embedJpg(data)
        : await document.embedPng(data)
      const sheet = layout === 'a4' ? PageSizes.A4 : PageSizes.Letter
      const [width, height] =
        layout === 'photo'
          ? [bitmap.width * 0.75, bitmap.height * 0.75]
          : bitmap.width > bitmap.height
            ? [sheet[1], sheet[0]]
            : sheet
      const margin = layout === 'photo' ? 0 : 24
      const page = document.addPage([width, height])
      const fitted = image.scaleToFit(width - margin * 2, height - margin * 2)
      page.drawImage(image, {
        ...fitted,
        x: (width - fitted.width) / 2,
        y: (height - fitted.height) / 2,
      })
    } finally {
      bitmap.close()
      canvas.width = 0
    }
  }
  signal.throwIfAborted()
  return savePDF(document)
}
