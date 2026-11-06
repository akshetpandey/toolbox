import { canvasBlob, loadEditablePDF, savePDF } from './pdf-edit'

export type PDFStampOptions =
  | { type: 'signature'; text: string; page: number; side: 'left' | 'right' }
  | { type: 'watermark'; text: string }

export async function stampPDF(file: Blob, stamp: PDFStampOptions) {
  const { degrees } = await import('pdf-lib')
  const document = await loadEditablePDF(file)
  const text = stamp.text.trim()
  if (!text) throw new Error('Enter the text to place on your PDF.')
  const signature = stamp.type === 'signature'
  const canvas = window.document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Text rendering is unavailable.')
  const font = signature ? 'italic 112px cursive' : 'bold 100px sans-serif'
  context.font = font
  const measured = context.measureText(text)
  canvas.width = Math.ceil(measured.width + 24)
  canvas.height = 180
  context.font = font
  context.textBaseline = 'middle'
  context.fillStyle = signature ? '#152846' : '#444'
  context.fillText(text, 12, 90)
  const image = await document.embedPng(
    await (await canvasBlob(canvas, 'image/png')).arrayBuffer(),
  )
  canvas.width = 0
  const pages = document.getPages()
  const target = stamp.type === 'signature' ? pages[stamp.page - 1] : undefined
  if (signature && !target) throw new Error('Choose a page in this PDF.')

  for (const page of target ? [target] : pages) {
    const crop = page.getCropBox()
    const rotation = ((page.getRotation().angle % 360) + 360) % 360
    const sideways = rotation === 90 || rotation === 270
    const width = sideways ? crop.height : crop.width
    const height = sideways ? crop.width : crop.height
    const size = signature
      ? image.scaleToFit(Math.min(width * 0.45, 160), height * 0.15)
      : image.scaleToFit(width * 0.67, height * 0.2)
    const angle = signature ? 0 : 30
    const radians = (angle * Math.PI) / 180
    const margin = Math.min(width, height) * 0.08
    const left =
      stamp.type === 'signature'
        ? stamp.side === 'left'
          ? margin
          : width - margin - size.width
        : (width -
            Math.cos(radians) * size.width +
            Math.sin(radians) * size.height) /
          2
    const bottom = signature
      ? margin
      : (height -
          Math.sin(radians) * size.width -
          Math.cos(radians) * size.height) /
        2

    let x = left
    let y = bottom
    if (rotation === 90) {
      x = crop.width - bottom
      y = left
    } else if (rotation === 180) {
      x = crop.width - left
      y = crop.height - bottom
    } else if (rotation === 270) {
      x = bottom
      y = crop.height - left
    }
    page.drawImage(image, {
      x: crop.x + x,
      y: crop.y + y,
      ...size,
      rotate: degrees(angle + rotation),
      opacity: signature ? 1 : 0.28,
    })
  }
  return savePDF(document)
}
