import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ImageFile } from '../shared'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockResize, mockWrite, mockImage, mockCompressPNG, mockDispose } =
  vi.hoisted(() => {
    const mockResize = vi.fn()
    const mockWrite = vi.fn()
    const mockAutoOrient = vi.fn()
    const mockImage = {
      width: 1920,
      height: 1080,
      format: { toString: () => 'JPEG' },
      colorSpace: { toString: () => 'sRGB' },
      depth: 8,
      compression: { toString: () => 'JPEG' },
      _quality: 85,
      get quality() {
        return this._quality
      },
      set quality(v: number) {
        this._quality = v
      },
      resize: mockResize,
      write: mockWrite,
      autoOrient: mockAutoOrient,
    }
    const mockCompressPNG = vi.fn()
    const mockDispose = vi.fn()
    return { mockResize, mockWrite, mockImage, mockCompressPNG, mockDispose }
  })

vi.mock('@imagemagick/magick-wasm', () => ({
  ImageMagick: {
    read: vi.fn((_data: Uint8Array, cb: (img: typeof mockImage) => void) =>
      cb(mockImage),
    ),
  },
  MagickFormat: {
    Jpeg: 'JPEG',
    Png: 'PNG',
    WebP: 'WEBP',
    Gif: 'GIF',
  },
  DitherMethod: {},
  ColorSpace: {},
  QuantizeSettings: class {},
}))

vi.mock('../libimagequant', () => ({
  LibImageQuantProcessor: vi.fn().mockImplementation(function () {
    return { compressPNG: mockCompressPNG, dispose: mockDispose }
  }),
}))

import { ImageMagickProcessor } from '../imagemagick'

function makeImageFile(overrides?: Partial<ImageFile>): ImageFile {
  return {
    file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'photo.jpg', {
      type: 'image/jpeg',
    }),
    preview: 'blob:preview',
    name: 'photo.jpg',
    size: 4,
    type: 'image/jpeg',
    dimensions: { width: 1920, height: 1080 },
    ...overrides,
  }
}

let processor: ImageMagickProcessor

beforeEach(() => {
  vi.clearAllMocks()
  mockImage._quality = 85
  mockImage.width = 1920
  mockImage.height = 1080
  // Default mock for write: returns small JPEG-like bytes
  mockWrite.mockImplementation(
    (_format: string, cb: (data: Uint8Array) => void) => {
      cb(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))
    },
  )
  processor = new ImageMagickProcessor()
})

// ─── extractMetadata ─────────────────────────────────────────────────────────

describe('ImageMagickProcessor.extractMetadata', () => {
  test('returns image metadata from ImageMagick', async () => {
    const imageFile = makeImageFile()
    const meta = await processor.extractMetadata(imageFile)

    expect(meta.width).toBe(1920)
    expect(meta.height).toBe(1080)
    expect(meta.format).toBe('JPEG')
    expect(meta.colorspace).toBe('sRGB')
    expect(meta.depth).toBe(8)
    expect(meta.compression).toBe('JPEG')
    expect(meta.size).toBe(imageFile.size)
  })

  test('returns fallback metadata when file reading fails', async () => {
    const imageFile = makeImageFile({
      dimensions: { width: 640, height: 480 },
      type: 'image/png',
      size: 12345,
    })
    // Make arrayBuffer() reject so the try-catch in extractMetadata catches it
    Object.defineProperty(imageFile.file, 'arrayBuffer', {
      value: () => Promise.reject(new Error('Read failed')),
    })

    const meta = await processor.extractMetadata(imageFile)

    expect(meta.width).toBe(640)
    expect(meta.height).toBe(480)
    expect(meta.format).toBe('PNG')
    expect(meta.size).toBe(12345)
  })
})

// ─── resizeImage ─────────────────────────────────────────────────────────────

describe('ImageMagickProcessor.resizeImage', () => {
  test('resizes to exact dimensions when aspect ratio is not maintained', async () => {
    const imageFile = makeImageFile()
    const blob = await processor.resizeImage(imageFile, {
      width: 800,
      height: 600,
      maintainAspectRatio: false,
    })

    expect(mockResize).toHaveBeenCalledWith(800, 600)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/jpeg')
  })

  test('resizes maintaining aspect ratio (width-constrained)', async () => {
    const imageFile = makeImageFile()
    // 1920x1080 (1.78) → target 800x600 (1.33). Since 1.78 > 1.33, width-constrained
    await processor.resizeImage(imageFile, {
      width: 800,
      height: 600,
      maintainAspectRatio: true,
    })

    expect(mockResize).toHaveBeenCalledWith(800, expect.any(Number))
    const [, height] = mockResize.mock.calls[0] as [number, number]
    expect(height).toBeLessThan(600)
  })

  test('resizes maintaining aspect ratio (height-constrained)', async () => {
    mockImage.width = 600
    mockImage.height = 1200

    const imageFile = makeImageFile({
      type: 'image/png',
      dimensions: { width: 600, height: 1200 },
    })

    await processor.resizeImage(imageFile, {
      width: 800,
      height: 600,
      maintainAspectRatio: true,
    })

    expect(mockResize).toHaveBeenCalled()
    const [width] = mockResize.mock.calls[0] as [number, number]
    expect(width).toBeLessThan(800)
  })

  test('outputs JPEG format for JPEG input', async () => {
    const imageFile = makeImageFile({ type: 'image/jpeg' })
    await processor.resizeImage(imageFile, {
      width: 400,
      height: 300,
      maintainAspectRatio: false,
    })

    expect(mockWrite).toHaveBeenCalledWith('JPEG', expect.any(Function))
  })

  test('outputs PNG format for PNG input', async () => {
    const imageFile = makeImageFile({
      type: 'image/png',
      name: 'image.png',
      file: new File([new Uint8Array(4)], 'image.png', { type: 'image/png' }),
    })
    await processor.resizeImage(imageFile, {
      width: 400,
      height: 300,
      maintainAspectRatio: false,
    })

    expect(mockWrite).toHaveBeenCalledWith('PNG', expect.any(Function))
  })

  test('outputs WebP format for WebP input', async () => {
    const imageFile = makeImageFile({
      type: 'image/webp',
      name: 'image.webp',
      file: new File([new Uint8Array(4)], 'image.webp', { type: 'image/webp' }),
    })
    await processor.resizeImage(imageFile, {
      width: 400,
      height: 300,
      maintainAspectRatio: false,
    })

    expect(mockWrite).toHaveBeenCalledWith('WEBP', expect.any(Function))
  })
})

// ─── convertImage ────────────────────────────────────────────────────────────

describe('ImageMagickProcessor.convertImage', () => {
  test('converts to WebP', async () => {
    const imageFile = makeImageFile()
    const blob = await processor.convertImage(imageFile, {
      targetFormat: 'webp',
    })

    expect(mockWrite).toHaveBeenCalledWith('WEBP', expect.any(Function))
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/webp')
  })

  test('converts to PNG', async () => {
    const imageFile = makeImageFile()
    const blob = await processor.convertImage(imageFile, {
      targetFormat: 'png',
    })

    expect(mockWrite).toHaveBeenCalledWith('PNG', expect.any(Function))
    expect(blob.type).toBe('image/png')
  })

  test('converts to JPEG', async () => {
    const imageFile = makeImageFile({ type: 'image/png' })
    const blob = await processor.convertImage(imageFile, {
      targetFormat: 'jpg',
    })

    expect(mockWrite).toHaveBeenCalledWith('JPEG', expect.any(Function))
    expect(blob.type).toBe('image/jpeg')
  })

  test('converts to GIF', async () => {
    const imageFile = makeImageFile()
    const blob = await processor.convertImage(imageFile, {
      targetFormat: 'gif',
    })

    expect(mockWrite).toHaveBeenCalledWith('GIF', expect.any(Function))
    expect(blob.type).toBe('image/gif')
  })

  test('defaults to WebP for unknown format', async () => {
    const imageFile = makeImageFile()
    const blob = await processor.convertImage(imageFile, {
      targetFormat: 'unknown',
    })

    expect(mockWrite).toHaveBeenCalledWith('WEBP', expect.any(Function))
    expect(blob.type).toBe('image/webp')
  })
})

// ─── compressImage ───────────────────────────────────────────────────────────

describe('ImageMagickProcessor.compressImage', () => {
  test('uses libimagequant for PNG files', async () => {
    const compressedBlob = new Blob(['compressed'], { type: 'image/png' })
    mockCompressPNG.mockResolvedValue(compressedBlob)

    const imageFile = makeImageFile({
      type: 'image/png',
      name: 'photo.png',
      file: new File([new Uint8Array(4)], 'photo.png', { type: 'image/png' }),
    })
    const result = await processor.compressImage(imageFile, { quality: 80 })

    expect(mockCompressPNG).toHaveBeenCalledWith(imageFile, 80)
    expect(result).toBe(compressedBlob)
  })

  test('falls back to ImageMagick when libimagequant fails for PNG', async () => {
    mockCompressPNG.mockRejectedValue(new Error('Quantization failed'))

    const imageFile = makeImageFile({
      type: 'image/png',
      name: 'photo.png',
      file: new File([new Uint8Array(4)], 'photo.png', { type: 'image/png' }),
    })
    const result = await processor.compressImage(imageFile, { quality: 80 })

    expect(result).toBeInstanceOf(Blob)
    expect(mockWrite).toHaveBeenCalledWith('PNG', expect.any(Function))
  })

  test('compresses JPEG directly with ImageMagick', async () => {
    const imageFile = makeImageFile()
    const result = await processor.compressImage(imageFile, { quality: 75 })

    expect(mockCompressPNG).not.toHaveBeenCalled()
    expect(result).toBeInstanceOf(Blob)
    expect(mockWrite).toHaveBeenCalledWith('JPEG', expect.any(Function))
  })

  test('compresses WebP with ImageMagick', async () => {
    const imageFile = makeImageFile({
      type: 'image/webp',
      name: 'photo.webp',
      file: new File([new Uint8Array(4)], 'photo.webp', { type: 'image/webp' }),
    })
    const result = await processor.compressImage(imageFile, { quality: 80 })

    expect(result).toBeInstanceOf(Blob)
    expect(mockWrite).toHaveBeenCalledWith('WEBP', expect.any(Function))
  })

  test('detects PNG by file extension when MIME type is generic', async () => {
    const compressedBlob = new Blob(['compressed'], { type: 'image/png' })
    mockCompressPNG.mockResolvedValue(compressedBlob)

    const imageFile = makeImageFile({
      type: 'image/x-png',
      name: 'photo.png',
      file: new File([new Uint8Array(4)], 'photo.png', { type: 'image/x-png' }),
    })
    const result = await processor.compressImage(imageFile, { quality: 80 })

    expect(mockCompressPNG).toHaveBeenCalled()
    expect(result).toBe(compressedBlob)
  })
})

// ─── dispose ─────────────────────────────────────────────────────────────────

describe('ImageMagickProcessor.dispose', () => {
  test('disposes the libimagequant processor', () => {
    processor.dispose()
    expect(mockDispose).toHaveBeenCalled()
  })
})
