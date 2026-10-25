import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { ImageFile } from '../shared'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockQuantizePng, mockLibDispose } = vi.hoisted(() => ({
  mockQuantizePng: vi.fn(),
  mockLibDispose: vi.fn(),
}))

vi.mock('libimagequant-wasm', () => ({
  default: vi.fn().mockImplementation(function () {
    return { quantizePng: mockQuantizePng, dispose: mockLibDispose }
  }),
}))

import LibImageQuant from 'libimagequant-wasm'
import { LibImageQuantProcessor } from '../libimagequant'

function makeImageFile(overrides?: Partial<ImageFile>): ImageFile {
  return {
    file: new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'image.png', {
      type: 'image/png',
    }),
    preview: 'blob:preview',
    name: 'image.png',
    size: 4,
    type: 'image/png',
    ...overrides,
  }
}

let processor: LibImageQuantProcessor

beforeEach(() => {
  vi.clearAllMocks()
  processor = new LibImageQuantProcessor()
})

// ─── compressPNG ─────────────────────────────────────────────────────────────

describe('LibImageQuantProcessor.compressPNG', () => {
  test('quantizes a PNG file and returns a Blob', async () => {
    const compressedBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])
    mockQuantizePng.mockResolvedValue({
      pngBytes: compressedBytes,
      paletteLength: 64,
      quality: 80,
    })

    const imageFile = makeImageFile()
    const result = await processor.compressPNG(imageFile, 80)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/png')
    expect(mockQuantizePng).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      expect.objectContaining({
        maxColors: 256,
        quality: { min: 0, target: 80 },
        speed: 3,
        dithering: 0.7,
        metadata: 'safe',
      }),
    )
  })

  test('includes the complete PNG byte view without copying unrelated buffer bytes', async () => {
    const buffer = new Uint8Array([99, 98, 0x89, 0x50, 0x4e, 0x47, 97])
    const pngBytes = buffer.subarray(2, 6)
    mockQuantizePng.mockResolvedValue({
      pngBytes,
      paletteLength: 4,
      quality: 80,
    })
    const blob = await processor.compressPNG(makeImageFile(), 80)
    const reader = new FileReader()
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () =>
        reject(new Error('Could not read the compressed PNG'))
      reader.readAsArrayBuffer(blob)
    })
    expect(new Uint8Array(bytes)).toEqual(pngBytes)
  })

  test('concurrent first requests share one lazy quantizer', async () => {
    mockQuantizePng.mockResolvedValue({
      pngBytes: new Uint8Array(4),
      paletteLength: 4,
      quality: 80,
    })
    await Promise.all([
      processor.compressPNG(makeImageFile(), 80),
      processor.compressPNG(makeImageFile(), 60),
    ])
    expect(LibImageQuant).toHaveBeenCalledTimes(1)
    expect(mockQuantizePng).toHaveBeenCalledTimes(2)
  })

  test('passes correct quality options', async () => {
    mockQuantizePng.mockResolvedValue({
      pngBytes: new Uint8Array(4),
      paletteLength: 128,
      quality: 50,
    })

    const imageFile = makeImageFile()
    await processor.compressPNG(imageFile, 50)

    const options = mockQuantizePng.mock.calls[0][1] as {
      quality: { target: number; min: number }
    }
    expect(options.quality.target).toBe(50)
    expect(options.quality.min).toBe(0)
  })

  test('throws on quantization error', async () => {
    mockQuantizePng.mockRejectedValue(new Error('Quantization failed'))

    const imageFile = makeImageFile()
    await expect(processor.compressPNG(imageFile, 80)).rejects.toThrow(
      'Quantization failed',
    )
  })

  test('handles different quality values', async () => {
    mockQuantizePng.mockResolvedValue({
      pngBytes: new Uint8Array(4),
      paletteLength: 256,
      quality: 100,
    })

    const imageFile = makeImageFile()

    await processor.compressPNG(imageFile, 10)
    expect(
      (mockQuantizePng.mock.calls[0][1] as { quality: { target: number } })
        .quality.target,
    ).toBe(10)

    await processor.compressPNG(imageFile, 100)
    expect(
      (mockQuantizePng.mock.calls[1][1] as { quality: { target: number } })
        .quality.target,
    ).toBe(100)
  })
})

// ─── dispose ─────────────────────────────────────────────────────────────────

describe('LibImageQuantProcessor.dispose', () => {
  test('disposes the quantizer after use', async () => {
    mockQuantizePng.mockResolvedValue({
      pngBytes: new Uint8Array(4),
      paletteLength: 64,
      quality: 80,
    })

    await processor.compressPNG(makeImageFile(), 80)

    processor.dispose()
    expect(mockLibDispose).toHaveBeenCalled()
  })

  test('does nothing if quantizer was never initialized', () => {
    const freshProcessor = new LibImageQuantProcessor()
    freshProcessor.dispose()
    expect(mockLibDispose).not.toHaveBeenCalled()
  })

  test('disposal during the lazy import prevents creating an abandoned worker', async () => {
    const pending = processor.compressPNG(makeImageFile(), 80)
    processor.dispose()
    await expect(pending).rejects.toThrow('PNG compression was cancelled')
    expect(LibImageQuant).not.toHaveBeenCalled()
    expect(mockQuantizePng).not.toHaveBeenCalled()
  })

  test('nullifies the quantizer so it can be re-initialized', async () => {
    mockQuantizePng.mockResolvedValue({
      pngBytes: new Uint8Array(4),
      paletteLength: 64,
      quality: 80,
    })

    const imageFile = makeImageFile()

    await processor.compressPNG(imageFile, 80)
    processor.dispose()

    await processor.compressPNG(imageFile, 80)
    expect(mockQuantizePng).toHaveBeenCalledTimes(2)
  })
})
