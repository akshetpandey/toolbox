// @vitest-environment node

/**
 * E2E tests for ImageMagick WASM operations.
 * These tests load the real WASM binary and perform actual image processing.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
} from '@imagemagick/magick-wasm'

const fixturesDir = resolve(__dirname, 'fixtures')

// ─── WASM Setup ─────────────────────────────────────────────────────────────

const WASM_PATH = resolve(
  __dirname,
  '../../../node_modules/@imagemagick/magick-wasm/dist/magick.wasm',
)

beforeAll(async () => {
  const wasmBytes = readFileSync(WASM_PATH)
  await initializeImageMagick(wasmBytes)
}, 30_000)

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(fixturesDir, name)))
}

/** Get the first 4 bytes as hex string for magic byte checking */
function magicHex(data: Uint8Array): string {
  return Array.from(data.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ImageMagick WASM (e2e)', () => {
  describe('read image metadata', () => {
    test('reads PNG metadata', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(8)
        expect(img.height).toBe(8)
        expect(img.format).toBe(MagickFormat.Png)
      })
    })

    test('reads JPEG metadata', () => {
      const data = readFixture('sample.jpg')
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(8)
        expect(img.height).toBe(8)
        expect(img.format).toBe(MagickFormat.Jpeg)
      })
    })

    test('reads GIF metadata', () => {
      const data = readFixture('sample.gif')
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(4)
        expect(img.height).toBe(4)
        expect(img.format).toBe(MagickFormat.Gif)
      })
    })

    test('reads WebP metadata', () => {
      const data = readFixture('sample.webp')
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(4)
        expect(img.height).toBe(4)
        expect(img.format).toBe(MagickFormat.WebP)
      })
    })
  })

  describe('resize images', () => {
    test('resizes PNG to specific dimensions', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(8)
        expect(img.height).toBe(8)

        img.resize(4, 4)
        expect(img.width).toBe(4)
        expect(img.height).toBe(4)

        img.write(MagickFormat.Png, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // Verify still valid PNG
          expect(output[0]).toBe(0x89)
          expect(output[1]).toBe(0x50) // P
        })
      })
    })

    test('resizes with MagickGeometry (preserves aspect ratio)', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        const geometry = new MagickGeometry(4, 4)
        img.resize(geometry)
        expect(img.width).toBeLessThanOrEqual(4)
        expect(img.height).toBeLessThanOrEqual(4)
      })
    })

    test('upscales a small image', () => {
      const data = readFixture('sample.gif') // 4x4
      ImageMagick.read(data, (img) => {
        expect(img.width).toBe(4)
        img.resize(16, 16)
        expect(img.width).toBe(16)
        expect(img.height).toBe(16)
      })
    })
  })

  describe('convert between formats', () => {
    test('PNG → JPEG', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Jpeg, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // JPEG magic: FF D8
          expect(output[0]).toBe(0xff)
          expect(output[1]).toBe(0xd8)
        })
      })
    })

    test('PNG → WebP', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.WebP, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // WebP magic: RIFF
          expect(output[0]).toBe(0x52) // R
          expect(output[1]).toBe(0x49) // I
          expect(output[2]).toBe(0x46) // F
          expect(output[3]).toBe(0x46) // F
        })
      })
    })

    test('PNG → GIF', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Gif, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // GIF magic: GIF8
          expect(output[0]).toBe(0x47) // G
          expect(output[1]).toBe(0x49) // I
          expect(output[2]).toBe(0x46) // F
        })
      })
    })

    test('JPEG → PNG', () => {
      const data = readFixture('sample.jpg')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Png, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // PNG magic: 89 50 4E 47
          expect(magicHex(output)).toBe('89504e47')
        })
      })
    })

    test('JPEG → WebP', () => {
      const data = readFixture('sample.jpg')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.WebP, (output) => {
          expect(output.length).toBeGreaterThan(0)
          expect(output[0]).toBe(0x52) // R
        })
      })
    })

    test('WebP → PNG', () => {
      const data = readFixture('sample.webp')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Png, (output) => {
          expect(output.length).toBeGreaterThan(0)
          expect(magicHex(output)).toBe('89504e47')
        })
      })
    })

    test('WebP → JPEG', () => {
      const data = readFixture('sample.webp')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Jpeg, (output) => {
          expect(output.length).toBeGreaterThan(0)
          expect(output[0]).toBe(0xff)
          expect(output[1]).toBe(0xd8)
        })
      })
    })

    test('GIF → PNG', () => {
      const data = readFixture('sample.gif')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Png, (output) => {
          expect(output.length).toBeGreaterThan(0)
          expect(magicHex(output)).toBe('89504e47')
        })
      })
    })

    test('GIF → JPEG', () => {
      const data = readFixture('sample.gif')
      ImageMagick.read(data, (img) => {
        img.write(MagickFormat.Jpeg, (output) => {
          expect(output.length).toBeGreaterThan(0)
          expect(output[0]).toBe(0xff)
          expect(output[1]).toBe(0xd8)
        })
      })
    })
  })

  describe('image quality / compression', () => {
    test('JPEG compression with different quality levels', () => {
      const data = readFixture('sample.png')

      let highQualitySize = 0
      let lowQualitySize = 0

      ImageMagick.read(data, (img) => {
        img.quality = 95
        img.write(MagickFormat.Jpeg, (output) => {
          highQualitySize = output.length
        })
      })

      ImageMagick.read(data, (img) => {
        img.quality = 10
        img.write(MagickFormat.Jpeg, (output) => {
          lowQualitySize = output.length
        })
      })

      // Lower quality should produce smaller file (or equal for tiny images)
      expect(lowQualitySize).toBeLessThanOrEqual(highQualitySize)
    })

    test('WebP compression with quality setting', () => {
      const data = readFixture('sample.png')

      ImageMagick.read(data, (img) => {
        img.quality = 50
        img.write(MagickFormat.WebP, (output) => {
          expect(output.length).toBeGreaterThan(0)
          // Should still be valid WebP
          expect(output[0]).toBe(0x52) // R
        })
      })
    })
  })

  describe('image attributes', () => {
    test('reads color space information', () => {
      const data = readFixture('sample.png')
      ImageMagick.read(data, (img) => {
        expect(img.colorSpace).toBeDefined()
        expect(img.depth).toBeGreaterThan(0)
      })
    })

    test('reads image density when present', () => {
      const data = readFixture('sample.jpg')
      ImageMagick.read(data, (img) => {
        // Density object should always exist, values may be 0 if not embedded
        expect(img.density).toBeDefined()
        expect(img.density.x).toBeGreaterThanOrEqual(0)
        expect(img.density.y).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
