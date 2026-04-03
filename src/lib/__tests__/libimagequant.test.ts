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

vi.mock('libimagequant-wasm/worker?worker&url', () => ({
  default: 'mock-worker-url',
}))

vi.mock('libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url', () => ({
  default: 'mock-wasm-url',
}))

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
      }),
    )
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
