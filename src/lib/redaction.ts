interface RedactionBounds {
  x: number
  y: number
  width: number
  height: number
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create redaction canvas context')
  return { canvas, ctx }
}

/** Blur a crop and replace its pixels, never leaving the original underneath. */
export function applyBlurRedaction(
  ctx: CanvasRenderingContext2D,
  area: RedactionBounds,
  radius: number,
) {
  const x = Math.max(0, Math.floor(area.x))
  const y = Math.max(0, Math.floor(area.y))
  const right = Math.min(ctx.canvas.width, Math.ceil(area.x + area.width))
  const bottom = Math.min(ctx.canvas.height, Math.ceil(area.y + area.height))
  const width = right - x
  const height = bottom - y
  if (width <= 0 || height <= 0) return

  // A Gaussian blur spreads alpha beyond the source bounds. Extend its edge
  // pixels so even narrow selections stay opaque after blurring.
  const padding = Math.ceil(radius * 3)
  const crop = createCanvas(width, height)
  crop.ctx.putImageData(ctx.getImageData(x, y, width, height), 0, 0)

  const padded = createCanvas(width + padding * 2, height + padding * 2)
  const sourceEdges = [0, 0, width - 1]
  const sourceWidths = [1, width, 1]
  const targetEdges = [0, padding, padding + width]
  const targetWidths = [padding, width, padding]
  const sourceTopEdges = [0, 0, height - 1]
  const sourceHeights = [1, height, 1]
  const targetTopEdges = [0, padding, padding + height]
  const targetHeights = [padding, height, padding]

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 3; column++) {
      padded.ctx.drawImage(
        crop.canvas,
        sourceEdges[column],
        sourceTopEdges[row],
        sourceWidths[column],
        sourceHeights[row],
        targetEdges[column],
        targetTopEdges[row],
        targetWidths[column],
        targetHeights[row],
      )
    }
  }

  const blurred = createCanvas(width, height)
  blurred.ctx.filter = `blur(${radius}px)`
  blurred.ctx.drawImage(padded.canvas, -padding, -padding)

  // putImageData replaces RGBA values. Drawing a partly transparent blurred
  // crop over the original would preserve sharp detail below the blur.
  ctx.putImageData(blurred.ctx.getImageData(0, 0, width, height), x, y)
}
