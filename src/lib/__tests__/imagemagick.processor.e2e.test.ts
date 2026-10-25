// @vitest-environment node
import { beforeAll, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  Drawables,
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
  MagickImage,
  MagickImageCollection,
} from '@imagemagick/magick-wasm'
import type { ImageFile } from '../shared'

// These cases use ImageMagick, not the PNG quantizer's browser worker.
vi.mock('../libimagequant', () => ({
  LibImageQuantProcessor: class {},
}))
import { ImageMagickProcessor } from '../imagemagick'

beforeAll(async () => {
  await initializeImageMagick(
    readFileSync(
      new URL(import.meta.resolve('@imagemagick/magick-wasm/magick.wasm')),
    ),
  )
})

function imageFile(
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  type: string,
): ImageFile {
  const file = new File([bytes], name, { type })
  return { file, name, type, size: file.size, preview: '' }
}

function animatedGif(): Uint8Array<ArrayBuffer> {
  return MagickImageCollection.use((images) => {
    for (const [index, color] of [
      MagickColors.Red,
      MagickColors.Blue,
    ].entries()) {
      const frame = MagickImage.create(MagickColors.Transparent, 8, 8)
      new Drawables().fillColor(color).rectangle(2, 2, 5, 5).draw(frame)
      frame.animationDelay = index === 0 ? 7 : 13
      frame.animationIterations = 0
      images.push(frame)
    }
    return images.write(MagickFormat.Gif, (bytes) => bytes.slice())
  })
}

test('the processor produces exact non-square dimensions when aspect lock is off', async () => {
  const bytes = readFileSync(new URL('./fixtures/sample.png', import.meta.url))
  const input = imageFile(new Uint8Array(bytes), 'sample.png', 'image/png')
  const processor = new ImageMagickProcessor()
  const result = await processor.resizeImage(input, {
    width: 20,
    height: 10,
    maintainAspectRatio: false,
  })
  expect(result.type).toBe('image/png')
  ImageMagick.read(new Uint8Array(await result.arrayBuffer()), (image) => {
    expect([image.width, image.height]).toEqual([20, 10])
  })
  const constrained = await processor.resizeImage(input, {
    width: 20,
    height: 10,
    maintainAspectRatio: true,
  })
  ImageMagick.read(new Uint8Array(await constrained.arrayBuffer()), (image) => {
    expect([image.width, image.height]).toEqual([10, 10])
  })
})

test.each(['resize', 'compress'] as const)(
  '%s preserves GIF encoding, transparency, frames, and timing',
  async (operation) => {
    const input = imageFile(animatedGif(), 'animated.gif', 'image/gif')
    const processor = new ImageMagickProcessor()
    const result =
      operation === 'resize'
        ? await processor.resizeImage(input, {
            width: 20,
            height: 10,
            maintainAspectRatio: false,
          })
        : await processor.compressImage(input, { quality: 60 })
    expect(result.type).toBe('image/gif')
    const bytes = new Uint8Array(await result.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('GIF8')
    ImageMagick.readCollection(bytes, (images) => {
      expect(images).toHaveLength(2)
      expect(images.map((image) => image.animationDelay)).toEqual([7, 13])
      expect(images[0].animationIterations).toBe(0)
      images.coalesce()
      for (const image of images) {
        expect(image.format).toBe(MagickFormat.Gif)
        expect([image.width, image.height]).toEqual(
          operation === 'resize' ? [20, 10] : [8, 8],
        )
        expect(image.getPixels((pixels) => pixels.getColor(0, 0)?.a)).toBe(0)
      }
      const x = operation === 'resize' ? 10 : 4
      const y = operation === 'resize' ? 5 : 4
      expect(
        images[0].getPixels((pixels) => pixels.getColor(x, y)?.r),
      ).not.toBe(images[1].getPixels((pixels) => pixels.getColor(x, y)?.r))
    })
  },
)
