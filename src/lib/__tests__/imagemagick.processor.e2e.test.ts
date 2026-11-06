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

const preinitializedMagick = () => import('@imagemagick/magick-wasm')

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
  const processor = new ImageMagickProcessor(preinitializedMagick)
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
    const processor = new ImageMagickProcessor(preinitializedMagick)
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

test('a HEIC photo can be decoded for preview and converted to JPG or PNG', async () => {
  const input = imageFile(
    new Uint8Array(
      readFileSync(new URL('./fixtures/sample.heic', import.meta.url)),
    ),
    'photo.heic',
    '',
  )
  const processor = new ImageMagickProcessor(preinitializedMagick)
  const preview = await processor.previewImage(input.file)
  expect(preview.dimensions).toEqual({ width: 8, height: 8 })
  expect(preview.blob.type).toBe('image/png')
  for (const [targetFormat, format, mime] of [
    ['jpg', 'JPEG', 'image/jpeg'],
    ['png', 'PNG', 'image/png'],
  ] as const) {
    const result = await processor.convertImage(input, { targetFormat })
    expect(result.type).toBe(mime)
    ImageMagick.read(new Uint8Array(await result.arrayBuffer()), (image) => {
      expect([image.format, image.width, image.height]).toEqual([format, 8, 8])
    })
  }
})

test('batch fitting shrinks large images and keeps smaller images at their original size', async () => {
  const bytes = readFileSync(new URL('./fixtures/sample.png', import.meta.url))
  const input = imageFile(new Uint8Array(bytes), 'sample.png', 'image/png')
  const processor = new ImageMagickProcessor(preinitializedMagick)
  for (const [box, output] of [
    [4, 4],
    [16, 8],
  ]) {
    const result = await processor.resizeImage(input, {
      width: box,
      height: box,
      maintainAspectRatio: true,
      onlyShrink: true,
    })
    ImageMagick.read(new Uint8Array(await result.arrayBuffer()), (image) => {
      expect([image.width, image.height]).toEqual([output, output])
    })
  }
})

test('crop, rotate and flip preserve GIF frames, timing and transparent pixels', async () => {
  const { file } = imageFile(animatedGif(), 'animated.gif', 'image/gif')
  const { blob, width, height } = await new ImageMagickProcessor(
    preinitializedMagick,
  ).transformImage(file, {
    crop: { x: 1, y: 1, width: 6, height: 5 },
    rotation: 90,
    flipHorizontal: true,
    flipVertical: true,
  })
  expect([width, height]).toEqual([5, 6])
  ImageMagick.readCollection(
    new Uint8Array(await blob.arrayBuffer()),
    (images) => {
      expect(images.map((image) => image.animationDelay)).toEqual([7, 13])
      images.coalesce()
      for (const image of images) {
        expect([image.width, image.height]).toEqual([5, 6])
        expect(image.getPixels((pixels) => pixels.getColor(4, 5)?.a)).toBe(0)
      }
    },
  )
})

test('target size never returns a JPG over the byte cap and can shrink dimensions with consent', async () => {
  const bytes = readFileSync(
    new URL('./fixtures/sample-real.jpg', import.meta.url),
  )
  const { file } = imageFile(new Uint8Array(bytes), 'photo.jpg', 'image/jpeg')
  const original = ImageMagick.read(bytes, (image) => ({
    width: image.width,
    height: image.height,
  }))
  const processor = new ImageMagickProcessor(preinitializedMagick)
  const cap = 1_000
  await expect(processor.compressToSize(file, cap, false)).resolves.toBeNull()
  const result = await processor.compressToSize(file, cap, true)
  expect(result).not.toBeNull()
  expect(result?.blob.type).toBe('image/jpeg')
  expect(result?.blob.size).toBeLessThanOrEqual(cap)
  expect(result?.width).toBeLessThan(original.width)
  expect(result?.height).toBeLessThan(original.height)
})

test('solid background removal turns matching pixels transparent and leaves other colors visible', async () => {
  const bytes = ImageMagick.read(MagickColors.White, 8, 8, (image) => {
    new Drawables()
      .fillColor(MagickColors.Red)
      .rectangle(2, 2, 5, 5)
      .draw(image)
    return image.write(MagickFormat.Png, (data) => data.slice())
  })
  const { file } = imageFile(bytes, 'solid.png', 'image/png')
  const blob = await new ImageMagickProcessor(
    preinitializedMagick,
  ).removeBackgroundColor(file, '#ffffff', 0)
  ImageMagick.read(new Uint8Array(await blob.arrayBuffer()), (image) => {
    expect(image.getPixels((pixels) => pixels.getColor(0, 0)?.a)).toBe(0)
    expect(
      image.getPixels((pixels) => pixels.getColor(3, 3)?.a),
    ).toBeGreaterThan(0)
  })
})
