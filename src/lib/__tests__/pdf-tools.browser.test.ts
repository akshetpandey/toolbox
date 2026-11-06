import { describe, expect, test } from 'vitest'
import { PDFArray, PDFDocument, PDFName, rgb } from 'pdf-lib'
import { unzipSync } from 'fflate'
import {
  canvasBlob,
  extractPDFPages,
  imagesToPDF,
  organizePDF,
  parsePageRanges,
  savePDF,
} from '../pdf-edit'
import { compressPDF } from '../pdf-compress'
import { exportPDFImages, openBrowserPDF, renderPDFPage } from '../pdf-render'
import { makeSearchablePDF, redactPDF } from '../pdf-privacy'
import { stampPDF } from '../pdf-stamp'

const signal = new AbortController().signal

async function sample() {
  const document = await PDFDocument.create()
  document.setTitle('Confidential metadata')
  document.addPage([300, 200]).drawText('Confidential text', {
    x: 15,
    y: 150,
    size: 24,
    color: rgb(0, 0, 0),
  })
  document.addPage([200, 300]).drawText('Second page')
  return savePDF(document)
}

async function renderedText(blob: Blob, pageNumber = 1) {
  const document = await openBrowserPDF(blob)
  try {
    const page = await document.getPage(pageNumber)
    const { items } = await page.getTextContent()
    return items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' ')
  } finally {
    await document.loadingTask.destroy()
  }
}

describe('browser-only PDF tools', () => {
  test('extracts, splits and organizes pages in the chosen order', async () => {
    const input = await sample()
    expect(parsePageRanges('2, 1-2', 2)).toEqual([[1], [0, 1]])
    expect(() => parsePageRanges('0-1', 2)).toThrow('between 1 and 2')
    const extracted = await extractPDFPages(input, '2', false, signal)
    expect(await renderedText(extracted.blob)).toBe('Second page')

    const split = await extractPDFPages(input, '', true, signal)
    const files = unzipSync(new Uint8Array(await split.blob.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['part-001.pdf', 'part-002.pdf'])
    const second = await PDFDocument.load(files['part-002.pdf'])
    expect(second.getPageCount()).toBe(1)

    const arranged = await organizePDF(input, [{ index: 1, rotation: 90 }])
    const reorganized = await PDFDocument.load(await arranged.arrayBuffer())
    expect(reorganized.getPageCount()).toBe(1)
    expect(reorganized.getPage(0).getRotation().angle).toBe(90)
    expect(await renderedText(arranged)).toBe('Second page')
  })

  test('compresses a PDF without losing selectable text or growing the file', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 360
    const context = canvas.getContext('2d')!
    const noise = context.createImageData(canvas.width, canvas.height)
    for (let index = 0; index < noise.data.length; index += 4) {
      const value = (index ^ (index >>> 7) ^ (index >>> 13)) % 255
      noise.data.set([value, 255 - value, value ^ 0x66, 255], index)
    }
    context.putImageData(noise, 0, 0)
    const photo = await canvasBlob(canvas, 'image/jpeg', 1)
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([480, 360])
    page.drawImage(await pdf.embedJpg(await photo.arrayBuffer()))
    page.drawText('Text stays selectable', { x: 20, y: 20, size: 16 })
    const original = await savePDF(pdf)
    const compressed = await compressPDF(original, 'small', signal)
    expect(compressed.size).toBeLessThan(original.size)
    expect(await renderedText(compressed)).toBe('Text stays selectable')
  })

  test('round trips PNG files through PDF and exports multiple pages as a ZIP', async () => {
    const original = await sample()
    const archive = await exportPDFImages(
      original,
      [0, 1],
      'png',
      1,
      signal,
      () => undefined,
    )
    const images = unzipSync(new Uint8Array(await archive.arrayBuffer()))
    const files = Object.entries(images).map(
      ([name, data]) =>
        new File([data], name, {
          type: 'image/png',
        }),
    )
    const rebuilt = await imagesToPDF(files, 'photo', signal)
    const result = await PDFDocument.load(await rebuilt.arrayBuffer())
    expect(result.getPages().map((page) => page.getSize())).toEqual([
      { width: 225, height: 150 },
      { width: 150, height: 225 },
    ])
  })

  test('redaction burns in opaque boxes and leaves no original text or title', async () => {
    const original = await sample()
    const output = await redactPDF(
      original,
      [{ page: 1, x: 0, y: 0, width: 0.75, height: 0.4 }],
      signal,
      () => undefined,
    )
    const stripped = await PDFDocument.load(await output.arrayBuffer())
    expect(stripped.getTitle()).toBeUndefined()
    expect(
      stripped
        .getPage(0)
        .node.lookupMaybe(PDFName.of('Annots'), PDFArray)
        ?.size() ?? 0,
    ).toBe(0)
    expect(await renderedText(output)).toBe('')
    expect(await renderedText(output, 2)).toBe('')
    const pdf = await openBrowserPDF(output)
    try {
      const { canvas } = await renderPDFPage(await pdf.getPage(1), 1)
      const context = canvas.getContext('2d')!
      expect(Array.from(context.getImageData(20, 40, 1, 1).data)).toEqual([
        0, 0, 0, 255,
      ])
      expect(Array.from(context.getImageData(290, 190, 1, 1).data)).toEqual([
        255, 255, 255, 255,
      ])
    } finally {
      await pdf.loadingTask.destroy()
    }
  })

  test('uses same-origin OCR engines to add searchable text to a scan', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 240
    const context = canvas.getContext('2d')!
    context.fillStyle = '#fff'
    context.fillRect(0, 0, 640, 240)
    context.fillStyle = '#000'
    context.font = 'bold 44px sans-serif'
    context.fillText('TOOLBOX SEARCH', 55, 120)
    const image = await canvasBlob(canvas, 'image/png')
    const scan = await imagesToPDF(
      [new File([image], 'scan.png', { type: 'image/png' })],
      'photo',
      signal,
    )
    expect(await renderedText(scan)).toBe('')
    const result = await makeSearchablePDF(scan, signal, () => undefined)
    expect(result.recognized).toBe(1)
    expect(await renderedText(result.blob)).toMatch(/TOOLBOX\s+SEARCH/)
  })

  test('adds stamps while keeping the original text selectable', async () => {
    const original = await sample()
    const signed = await stampPDF(original, {
      type: 'signature',
      text: 'Ada Example',
      page: 2,
      side: 'right',
    })
    const watermarked = await stampPDF(signed, {
      type: 'watermark',
      text: 'Draft',
    })
    expect(await renderedText(watermarked)).toBe('Confidential text')
    expect(await renderedText(watermarked, 2)).toBe('Second page')
  })
})
