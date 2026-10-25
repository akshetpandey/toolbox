import { expect, test } from 'vitest'
import { applyBlurRedaction } from '../redaction'

function stripedCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context is unavailable')
  for (let x = 0; x < width; x++) {
    ctx.fillStyle = x % 2 === 0 ? '#000000' : '#ffffff'
    ctx.fillRect(x, 0, 1, height)
  }
  return { canvas, ctx }
}

async function exportedPixels(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error('PNG export failed')),
      'image/png',
    )
  })
  const image = await createImageBitmap(blob)
  const decoded = document.createElement('canvas')
  decoded.width = image.width
  decoded.height = image.height
  const ctx = decoded.getContext('2d')
  if (!ctx) throw new Error('Canvas context is unavailable')
  ctx.drawImage(image, 0, 0)
  image.close()
  return ctx.getImageData(0, 0, decoded.width, decoded.height)
}

test.each([
  { x: 10, y: 8, width: 8, height: 8 },
  { x: 0, y: 0, width: 8, height: 8 },
  { x: -3, y: -2, width: 11, height: 10 },
])(
  'replaces original detail throughout a narrow high-blur crop at $x,$y',
  async (area) => {
    const { canvas, ctx } = stripedCanvas(32, 24)
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height)

    applyBlurRedaction(ctx, area, 30)

    const preview = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const exported = await exportedPixels(canvas)
    expect(exported.data).toEqual(preview.data)

    const x0 = Math.max(0, area.x)
    const y0 = Math.max(0, area.y)
    for (let y = y0; y < area.y + area.height; y++) {
      for (let x = x0; x < area.x + area.width; x++) {
        const offset = (y * canvas.width + x) * 4
        // The old source-over blur left the sharp black/white stripes underneath
        // (especially when the blur radius exceeded the crop dimensions).
        expect(preview.data[offset]).toBeGreaterThan(70)
        expect(preview.data[offset]).toBeLessThan(185)
        expect(preview.data[offset + 3]).toBe(255)
      }
    }

    // Keep the replacement confined to the selected crop, including at edges.
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (
          x >= x0 &&
          x < area.x + area.width &&
          y >= y0 &&
          y < area.y + area.height
        )
          continue
        const offset = (y * canvas.width + x) * 4
        expect(preview.data.slice(offset, offset + 4)).toEqual(
          before.data.slice(offset, offset + 4),
        )
      }
    }
  },
)

test('replaces transparent pixels instead of showing original pixels below them', () => {
  const { ctx } = stripedCanvas(16, 16)
  ctx.clearRect(4, 4, 8, 8)
  applyBlurRedaction(ctx, { x: 4, y: 4, width: 8, height: 8 }, 20)
  const pixels = ctx.getImageData(4, 4, 8, 8).data
  expect(pixels.every((value) => value === 0)).toBe(true)
})
