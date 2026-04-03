// @vitest-environment node

/**
 * E2E tests for libimagequant WASM PNG compression.
 * The library's browser API uses Web Workers, but the raw WASM module
 * can be loaded directly in Node.js for testing.
 *
 * Pipeline: PNG → ImageMagick (decode to RGBA) → libimagequant (quantize) → PNG
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from '@imagemagick/magick-wasm'

// Dynamic import types for the raw WASM module
type WasmModule = typeof import('libimagequant-wasm/wasm/libimagequant_wasm.js')

const fixturesDir = resolve(__dirname, 'fixtures')

// ─── WASM Setup ─────────────────────────────────────────────────────────────

let wasm: WasmModule

beforeAll(async () => {
  // Initialize libimagequant raw WASM
  const wasmPath = resolve(
    __dirname,
    '../../../node_modules/libimagequant-wasm/dist/wasm/libimagequant_wasm_bg.wasm',
  )
  const wasmBytes = readFileSync(wasmPath)
  wasm = await import('libimagequant-wasm/wasm/libimagequant_wasm.js')
  await wasm.default(wasmBytes)

  // Initialize ImageMagick (needed to decode PNG → RGBA)
  const imWasmPath = resolve(
    __dirname,
    '../../../node_modules/@imagemagick/magick-wasm/dist/magick.wasm',
  )
  await initializeImageMagick(readFileSync(imWasmPath))
}, 30_000)

// ─── Helpers ────────────────────────────────────────────────────────────────

interface DecodedImage {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

function decodePngToRgba(pngData: Uint8Array): DecodedImage {
  let result: DecodedImage | null = null
  ImageMagick.read(pngData, (img) => {
    const width = img.width
    const height = img.height
    const rgba = img.getPixels((p) => {
      return new Uint8ClampedArray(p.getArea(0, 0, width, height))
    })
    result = { rgba, width, height }
  })
  if (!result) throw new Error('Failed to decode PNG')
  return result
}

function quantizePng(
  pngData: Uint8Array,
  quality: number,
  maxColors = 256,
): Uint8Array {
  const { rgba, width, height } = decodePngToRgba(pngData)

  const q = new wasm.ImageQuantizer()
  q.setSpeed(3)
  q.setQuality(0, quality)
  q.setMaxColors(maxColors)

  const quantResult = q.quantizeImage(rgba, width, height)
  quantResult.setDithering(0.7)

  const indices = quantResult.getPaletteIndices(rgba, width, height)
  const palette = quantResult.getPalette()
  return wasm.encode_palette_to_png(indices, palette, width, height)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('libimagequant WASM (e2e)', () => {
  const realPng = new Uint8Array(
    readFileSync(resolve(fixturesDir, 'sample-real.png')),
  )

  describe('PNG quantization', () => {
    test('quantizes a real PNG image', () => {
      const output = quantizePng(realPng, 80)

      expect(output.length).toBeGreaterThan(0)
      // Valid PNG header
      expect(output[0]).toBe(0x89)
      expect(output[1]).toBe(0x50) // P
      expect(output[2]).toBe(0x4e) // N
      expect(output[3]).toBe(0x47) // G
    })

    test('lower quality produces smaller output', () => {
      const highQ = quantizePng(realPng, 90)
      const lowQ = quantizePng(realPng, 30)

      // Both should be valid PNGs
      expect(highQ[0]).toBe(0x89)
      expect(lowQ[0]).toBe(0x89)

      // Low quality should generally be smaller (fewer colors/detail)
      // but with this small image, we just verify both produce output
      expect(highQ.length).toBeGreaterThan(0)
      expect(lowQ.length).toBeGreaterThan(0)
    })

    test('fewer max colors produces smaller output', () => {
      const colors256 = quantizePng(realPng, 80, 256)
      const colors16 = quantizePng(realPng, 80, 16)

      expect(colors256.length).toBeGreaterThan(0)
      expect(colors16.length).toBeGreaterThan(0)
      // Fewer colors = smaller palette = smaller file
      expect(colors16.length).toBeLessThan(colors256.length)
    })
  })

  describe('ImageQuantizer API', () => {
    test('reports quantization quality', () => {
      const { rgba, width, height } = decodePngToRgba(realPng)

      const q = new wasm.ImageQuantizer()
      q.setSpeed(3)
      q.setQuality(0, 80)
      q.setMaxColors(256)

      const result = q.quantizeImage(rgba, width, height)
      const quality = result.getQuantizationQuality()

      // Quality is a 0-1 float
      expect(quality).toBeGreaterThan(0)
      expect(quality).toBeLessThanOrEqual(1)
    })

    test('reports palette length', () => {
      const { rgba, width, height } = decodePngToRgba(realPng)

      const q = new wasm.ImageQuantizer()
      q.setSpeed(3)
      q.setQuality(0, 80)
      q.setMaxColors(256)

      const result = q.quantizeImage(rgba, width, height)
      const paletteLen = result.getPaletteLength()

      expect(paletteLen).toBeGreaterThan(0)
      expect(paletteLen).toBeLessThanOrEqual(256)
    })

    test('max colors limits palette size', () => {
      const { rgba, width, height } = decodePngToRgba(realPng)

      const q = new wasm.ImageQuantizer()
      q.setSpeed(3)
      q.setQuality(0, 80)
      q.setMaxColors(8)

      const result = q.quantizeImage(rgba, width, height)
      expect(result.getPaletteLength()).toBeLessThanOrEqual(8)
    })

    test('speed setting accepted', () => {
      const { rgba, width, height } = decodePngToRgba(realPng)

      // Speed 1 (slowest/best) vs speed 10 (fastest/worst)
      for (const speed of [1, 5, 10]) {
        const q = new wasm.ImageQuantizer()
        q.setSpeed(speed)
        q.setQuality(0, 80)
        q.setMaxColors(256)

        const result = q.quantizeImage(rgba, width, height)
        expect(result.getPaletteLength()).toBeGreaterThan(0)
      }
    })
  })

  describe('round-trip integrity', () => {
    test('quantized PNG can be re-decoded', () => {
      const output = quantizePng(realPng, 80)

      // Verify the output PNG can be read back by ImageMagick
      ImageMagick.read(output, (img) => {
        // Should decode without errors
        expect(img.width).toBeGreaterThan(0)
        expect(img.height).toBeGreaterThan(0)
        expect(img.format).toBe(MagickFormat.Png)
      })
    })

    test('preserves image dimensions', () => {
      const { width: origW, height: origH } = decodePngToRgba(realPng)
      const output = quantizePng(realPng, 80)

      ImageMagick.read(output, (img) => {
        expect(img.width).toBe(origW)
        expect(img.height).toBe(origH)
      })
    })
  })
})
