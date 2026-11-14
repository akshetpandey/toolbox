interface RedactionBounds {
  x: number
  y: number
  width: number
  height: number
}

interface BlurKernel {
  left: number
  right: number
  weights?: Float32Array
}

function gaussianKernels(sigma: number): BlurKernel[] {
  // Match the raster canvas renderer's Gaussian approximation, including its
  // even-width boxes: https://www.w3.org/TR/filter-effects/#feGaussianBlurElement.
  // Subpixel sigmas need a direct kernel because a unit box would do nothing.
  if (sigma < 1) {
    const radius = Math.ceil(sigma * 3)
    const weights = Float32Array.from({ length: radius * 2 + 1 }, (_, i) =>
      Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
    )
    const sum = weights.reduce((total, value) => total + value, 0)
    for (let i = 0; i < weights.length; i++) weights[i] /= sum
    return [{ left: radius, right: radius, weights }]
  }
  const size = Math.floor((sigma * 3 * Math.sqrt(2 * Math.PI)) / 4 + 0.5)
  const half = Math.floor(size / 2)
  if (size % 2)
    return Array.from({ length: 3 }, () => ({ left: half, right: half }))
  // Even boxes need opposite half-pixel offsets to keep the result centered.
  return [
    { left: half, right: half - 1 },
    { left: half - 1, right: half },
    { left: half, right: half },
  ]
}

/** Filter extended scanlines, keeping the original edge extension for all passes. */
function blurAxis(
  pixels: Float32Array,
  line: Float32Array,
  scratch: Float32Array,
  width: number,
  height: number,
  kernels: BlurKernel[],
  edgePadding: number,
  horizontal: boolean,
) {
  const length = horizontal ? width : height
  const count = horizontal ? height : width
  const step = horizontal ? 4 : width * 4
  const lineStep = horizontal ? width * 4 : 4
  const left = kernels.reduce((sum, kernel) => sum + kernel.left, 0)
  const right = kernels.reduce((sum, kernel) => sum + kernel.right, 0)

  for (let row = 0; row < count; row++) {
    const start = row * lineStep
    let size = length + left + right
    for (let i = 0; i < size; i++) {
      let position = i - left
      // Match the previous canvas path's bilinear stretching of one-pixel
      // edge strips. Clamping anew after each pass changes the crop borders.
      if (position < 0)
        position = Math.max(0, 0.5 + (position + 0.5) / edgePadding)
      else if (position >= length)
        position = Math.max(
          0,
          Math.min(
            length - 1,
            length - 1.5 + (position - length + 0.5) / edgePadding,
          ),
        )
      const lower = Math.floor(position)
      const fraction = position - lower
      const source = start + lower * step
      const next = start + Math.min(length - 1, lower + 1) * step
      for (let channel = 0; channel < 4; channel++) {
        line[i * 4 + channel] =
          pixels[source + channel] * (1 - fraction) +
          pixels[next + channel] * fraction
      }
    }
    let input = line
    let output = scratch
    for (const kernel of kernels) {
      const window = kernel.left + kernel.right + 1
      size -= window - 1
      for (let channel = 0; channel < 4; channel++) {
        if (kernel.weights) {
          for (let i = 0; i < size; i++) {
            let sum = 0
            for (let k = 0; k < window; k++)
              sum += input[(i + k) * 4 + channel] * kernel.weights[k]
            output[i * 4 + channel] = sum
          }
        } else {
          let sum = 0
          for (let k = 0; k < window; k++) sum += input[k * 4 + channel]
          for (let i = 0; i < size; i++) {
            output[i * 4 + channel] = sum / window
            if (i + 1 < size)
              sum += input[(i + window) * 4 + channel] - input[i * 4 + channel]
          }
        }
      }
      ;[input, output] = [output, input]
    }
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < 4; channel++)
        pixels[start + i * step + channel] = input[i * 4 + channel]
    }
  }
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
  if (width <= 0 || height <= 0 || !Number.isFinite(radius) || radius <= 0)
    return

  // Safari can accept ctx.filter = 'blur(...)' without applying any blur.
  // Work on pixels in every browser so the preview and download use the same
  // implementation. Large radii stay linear in image size. Only scanlines are
  // padded, avoiding extra full-size canvases on phones.
  const image = ctx.getImageData(x, y, width, height)
  const pixels = new Float32Array(image.data.length)
  const kernels = gaussianKernels(radius)
  const padding = kernels.reduce(
    (sum, kernel) => sum + kernel.left + kernel.right,
    0,
  )
  const line = new Float32Array((Math.max(width, height) + padding) * 4)
  const scratch = new Float32Array(line.length)
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = image.data[i + 3] / 255
    // Filter premultiplied color to avoid dark halos around transparency.
    pixels[i] = image.data[i] * alpha
    pixels[i + 1] = image.data[i + 1] * alpha
    pixels[i + 2] = image.data[i + 2] * alpha
    pixels[i + 3] = image.data[i + 3]
  }
  const edgePadding = Math.ceil(radius * 3)
  blurAxis(pixels, line, scratch, width, height, kernels, edgePadding, true)
  blurAxis(pixels, line, scratch, width, height, kernels, edgePadding, false)
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    image.data[i + 3] = alpha
    const unpremultiply = image.data[i + 3] > 0 ? 255 / alpha : 0
    image.data[i] = pixels[i] * unpremultiply
    image.data[i + 1] = pixels[i + 1] * unpremultiply
    image.data[i + 2] = pixels[i + 2] * unpremultiply
  }
  // Replace RGBA values, including transparent pixels, rather than compositing
  // a translucent blur over sharp source detail.
  ctx.putImageData(image, x, y)
}
