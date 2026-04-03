// @vitest-environment node

/**
 * E2E tests for EXIF metadata extraction using the real @uswriting/exiftool WASM.
 * The WASI runtime needs a custom fetch handler to load zeroperl.wasm from
 * the filesystem rather than HTTP — provided here via a test helper.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'
import { createRequire } from 'module'

const fixturesDir = resolve(__dirname, 'fixtures')

// ─── WASM Setup ─────────────────────────────────────────────────────────────

// Find zeroperl.wasm - try multiple strategies for pnpm hoisting
function findZeroPerlWasm(): string | null {
  const projectRoot = resolve(__dirname, '../../..')

  // Strategy 1: direct path (non-pnpm or hoisted)
  const direct = resolve(
    projectRoot,
    'node_modules/@6over3/zeroperl-ts/dist/esm/zeroperl.wasm',
  )
  if (existsSync(direct)) return direct

  // Strategy 2: pnpm .pnpm store - glob for any version
  try {
    const found = execSync(
      `find "${projectRoot}/node_modules/.pnpm" -path "*/zeroperl-ts/dist/*/zeroperl.wasm" -type f 2>/dev/null | head -1`,
      { encoding: 'utf-8' },
    ).trim()
    if (found && existsSync(found)) return found
  } catch {
    // find not available
  }

  // Strategy 3: createRequire from exiftool context
  try {
    const exifEntry = createRequire(import.meta.url).resolve(
      '@uswriting/exiftool',
    )
    const exifRequire = createRequire(exifEntry)
    const zpEntry = exifRequire.resolve('@6over3/zeroperl-ts')
    const candidate = resolve(dirname(zpEntry), 'zeroperl.wasm')
    if (existsSync(candidate)) return candidate
  } catch {
    // resolution failed
  }

  return null
}

let parseMetadata: typeof import('@uswriting/exiftool').parseMetadata
let writeMetadata: typeof import('@uswriting/exiftool').writeMetadata
let zeroPerlWasm: Buffer

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Custom fetch handler that serves zeroperl.wasm from disk.
 * Required because the WASI runtime tries to fetch() it at runtime.
 */
function nodeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (typeof input === 'string' && input.endsWith('zeroperl.wasm')) {
    return Promise.resolve(
      new Response(new Uint8Array(zeroPerlWasm), {
        headers: { 'Content-Type': 'application/wasm' },
      }),
    )
  }
  return fetch(input, init)
}

type ExifData = Record<string, string | number | boolean | null>[]

async function extractExif(filePath: string): Promise<ExifData> {
  const data = readFileSync(filePath)
  const file = new File([data], filePath.split('/').pop()!, {
    type: 'image/jpeg',
  })

  const result = await parseMetadata(file, {
    args: ['-json', '-n'],
    transform: (raw: string) => JSON.parse(raw) as ExifData,
    fetch: nodeFetch as never,
  })

  if (!result.success) {
    throw new Error(`parseMetadata failed: ${String(result.error)}`)
  }
  return result.data
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('exiftool WASM (e2e)', () => {
  beforeAll(async () => {
    const wasmPath = findZeroPerlWasm()
    if (!wasmPath) {
      throw new Error('zeroperl.wasm not found — cannot run exiftool e2e tests')
    }

    zeroPerlWasm = readFileSync(wasmPath)
    const mod = await import('@uswriting/exiftool')
    parseMetadata = mod.parseMetadata
    writeMetadata = mod.writeMetadata
  }, 30_000)

  describe('EXIF metadata extraction', () => {
    test('extracts camera make and model from Canon photo', async () => {
      const data = await extractExif(resolve(fixturesDir, 'sample-exif.jpg'))

      expect(data).toBeInstanceOf(Array)
      expect(data.length).toBeGreaterThan(0)

      const meta = data[0]
      expect(meta.Make).toBe('Canon')
      expect(meta.Model).toBe('Canon EOS 40D')
    })

    test('extracts GPS data from geotagged Nikon photo', async () => {
      const data = await extractExif(resolve(fixturesDir, 'sample-real.jpg'))
      const meta = data[0]

      expect(meta.Make).toBe('NIKON')
      expect(meta.Model).toBe('COOLPIX P6000')
      // This image has GPS data
      expect(meta.GPSLatitude).toBeDefined()
      expect(meta.GPSLongitude).toBeDefined()
    })

    test('extracts image dimensions', async () => {
      const data = await extractExif(resolve(fixturesDir, 'sample-exif.jpg'))
      const meta = data[0]

      expect(meta.ImageWidth).toBe(100)
      expect(meta.ImageHeight).toBe(68)
    })

    test('extracts date/time information', async () => {
      const data = await extractExif(resolve(fixturesDir, 'sample-exif.jpg'))
      const meta = data[0]

      // Canon 40D test image has DateTime
      expect(meta.DateTimeOriginal).toBeDefined()
    })

    test('extracts file type information', async () => {
      const data = await extractExif(resolve(fixturesDir, 'sample-exif.jpg'))
      const meta = data[0]

      expect(meta.FileType).toBe('JPEG')
      expect(meta.MIMEType).toBe('image/jpeg')
    })

    test('handles image without EXIF gracefully', async () => {
      // sample.png has no EXIF data
      const pngData = readFileSync(resolve(fixturesDir, 'sample.png'))
      const file = new File([pngData], 'sample.png', { type: 'image/png' })

      const result = await parseMetadata(file, {
        args: ['-json', '-n'],
        transform: (raw: string) => JSON.parse(raw) as ExifData,
        fetch: nodeFetch as never,
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      // Should still return basic file info even without EXIF
      const meta = result.data![0]
      expect(meta.FileType).toBe('PNG')
    })
  })

  describe('metadata stripping', () => {
    test('strips EXIF metadata from JPEG without ICC profile', async () => {
      const originalData = readFileSync(resolve(fixturesDir, 'sample-real.jpg'))
      const file = new File([originalData], 'sample-real.jpg', {
        type: 'image/jpeg',
      })

      const result = await writeMetadata(
        file,
        {},
        {
          args: ['-all=', '--icc_profile:all'],
          fetch: nodeFetch as never,
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      const strippedBytes = new Uint8Array(result.data!)
      expect(strippedBytes.length).toBeGreaterThan(0)
      // Should still be a valid JPEG (FF D8)
      expect(strippedBytes[0]).toBe(0xff)
      expect(strippedBytes[1]).toBe(0xd8)

      // Verify the stripped file has no camera metadata
      const strippedFile = new File([strippedBytes], 'stripped.jpg', {
        type: 'image/jpeg',
      })
      const strippedResult = await parseMetadata(strippedFile, {
        args: ['-json', '-n'],
        transform: (raw: string) => JSON.parse(raw) as ExifData,
        fetch: nodeFetch as never,
      })

      expect(strippedResult.data).toBeDefined()
      const strippedMeta = strippedResult.data![0]
      expect(strippedMeta.Make).toBeUndefined()
      expect(strippedMeta.Model).toBeUndefined()
      expect(strippedMeta.GPSLatitude).toBeUndefined()
      expect(strippedMeta.FileType).toBe('JPEG')
    })

    test('strips EXIF metadata from JPEG with embedded ICC profile', async () => {
      // Canon EOS 40D photo has an ICC color profile embedded.
      // Without --icc_profile:all, exiftool emits a warning that the
      // @uswriting/exiftool WASM wrapper treats as an error, causing
      // the operation to fail. This test verifies the fix works.
      const originalData = readFileSync(resolve(fixturesDir, 'sample-exif.jpg'))
      const file = new File([originalData], 'sample-exif.jpg', {
        type: 'image/jpeg',
      })

      // First confirm this photo actually has an ICC profile
      const origResult = await parseMetadata(file, {
        args: ['-json', '-n', '-ICC_Profile:all'],
        transform: (raw: string) => JSON.parse(raw) as ExifData,
        fetch: nodeFetch as never,
      })
      expect(origResult.success).toBe(true)
      expect(origResult.data![0].ProfileDescription).toBeDefined()

      // Strip metadata while preserving ICC profile
      const result = await writeMetadata(
        file,
        {},
        {
          args: ['-all=', '--icc_profile:all'],
          fetch: nodeFetch as never,
        },
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      const strippedBytes = new Uint8Array(result.data!)
      expect(strippedBytes.length).toBeGreaterThan(0)
      expect(strippedBytes[0]).toBe(0xff)
      expect(strippedBytes[1]).toBe(0xd8)

      // Verify camera metadata is gone but ICC profile is preserved
      const strippedFile = new File([strippedBytes], 'stripped.jpg', {
        type: 'image/jpeg',
      })
      const strippedResult = await parseMetadata(strippedFile, {
        args: ['-json', '-n'],
        transform: (raw: string) => JSON.parse(raw) as ExifData,
        fetch: nodeFetch as never,
      })

      expect(strippedResult.data).toBeDefined()
      const strippedMeta = strippedResult.data![0]
      // Camera-specific fields should be gone
      expect(strippedMeta.Make).toBeUndefined()
      expect(strippedMeta.Model).toBeUndefined()
      expect(strippedMeta.DateTimeOriginal).toBeUndefined()
      // ICC color profile should be preserved
      expect(strippedMeta.ProfileDescription).toBeDefined()
      expect(strippedMeta.FileType).toBe('JPEG')
    })

    test('fails without ICC preservation on ICC-profiled images', async () => {
      // Demonstrate the bug: -all= alone fails on images with ICC profiles
      const originalData = readFileSync(resolve(fixturesDir, 'sample-exif.jpg'))
      const file = new File([originalData], 'sample-exif.jpg', {
        type: 'image/jpeg',
      })

      const result = await writeMetadata(
        file,
        {},
        {
          args: ['-all='],
          fetch: nodeFetch as never,
        },
      )

      // Without --icc_profile:all, writeMetadata fails due to ICC warning
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('ICC_Profile')
      }
    })
  })
})
