// @vitest-environment node

/**
 * E2E tests for metadata operations using real WASM modules.
 * Tests hash-wasm (MD5, SHA1, SHA256) and wasmagic (MIME detection).
 *
 * Note: @uswriting/exiftool (EXIF parsing/stripping) uses a WASI runtime
 * that doesn't work in Node.js, so those operations are NOT tested here.
 */
import { describe, test, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  createMD5,
  createSHA1,
  createSHA256,
  md5,
  sha1,
  sha256,
} from 'hash-wasm'
import type { WASMagic as WASMagicType } from 'wasmagic'

const fixturesDir = resolve(__dirname, 'fixtures')

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(fixturesDir, name)))
}

// ─── hash-wasm tests ────────────────────────────────────────────────────────

describe('hash-wasm (e2e)', () => {
  const sampleTxt = readFixture('sample.txt')

  test('calculates MD5 hash', async () => {
    const hash = await md5(sampleTxt)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    // Verify deterministic
    const hash2 = await md5(sampleTxt)
    expect(hash2).toBe(hash)
  })

  test('calculates SHA1 hash', async () => {
    const hash = await sha1(sampleTxt)
    expect(hash).toMatch(/^[0-9a-f]{40}$/)
  })

  test('calculates SHA256 hash', async () => {
    const hash = await sha256(sampleTxt)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('different files produce different hashes', async () => {
    const pngData = readFixture('sample.png')

    const txtMd5 = await md5(sampleTxt)
    const pngMd5 = await md5(pngData)
    expect(txtMd5).not.toBe(pngMd5)

    const txtSha256 = await sha256(sampleTxt)
    const pngSha256 = await sha256(pngData)
    expect(txtSha256).not.toBe(pngSha256)
  })

  test('empty data produces known hashes', async () => {
    const empty = new Uint8Array(0)
    const emptyMd5 = await md5(empty)
    const emptySha1 = await sha1(empty)
    const emptySha256 = await sha256(empty)

    // Well-known empty string hashes
    expect(emptyMd5).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(emptySha1).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(emptySha256).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  test('incremental hashing with createMD5', async () => {
    const hasher = await createMD5()
    hasher.update(sampleTxt.slice(0, 10))
    hasher.update(sampleTxt.slice(10))
    const incrementalHash = hasher.digest('hex')

    const directHash = await md5(sampleTxt)
    expect(incrementalHash).toBe(directHash)
  })

  test('incremental hashing with createSHA1', async () => {
    const hasher = await createSHA1()
    hasher.update(sampleTxt.slice(0, 10))
    hasher.update(sampleTxt.slice(10))
    const incrementalHash = hasher.digest('hex')

    const directHash = await sha1(sampleTxt)
    expect(incrementalHash).toBe(directHash)
  })

  test('incremental hashing with createSHA256', async () => {
    const hasher = await createSHA256()
    hasher.update(sampleTxt.slice(0, 10))
    hasher.update(sampleTxt.slice(10))
    const incrementalHash = hasher.digest('hex')

    const directHash = await sha256(sampleTxt)
    expect(incrementalHash).toBe(directHash)
  })

  test('hashes binary files correctly', async () => {
    const pngData = readFixture('sample.png')
    const jpgData = readFixture('sample.jpg')

    const pngHash = await sha256(pngData)
    const jpgHash = await sha256(jpgData)

    expect(pngHash).toMatch(/^[0-9a-f]{64}$/)
    expect(jpgHash).toMatch(/^[0-9a-f]{64}$/)
    expect(pngHash).not.toBe(jpgHash)
  })
})

// ─── wasmagic tests ─────────────────────────────────────────────────────────

describe('wasmagic MIME detection (e2e)', () => {
  let magic: WASMagicType

  beforeAll(async () => {
    const { WASMagic } = await import('wasmagic')
    magic = await WASMagic.create()
  }, 15_000)

  test('detects PNG files', () => {
    const data = readFixture('sample.png')
    expect(magic.getMime(data)).toBe('image/png')
  })

  test('detects JPEG files', () => {
    const data = readFixture('sample.jpg')
    expect(magic.getMime(data)).toBe('image/jpeg')
  })

  test('detects GIF files', () => {
    const data = readFixture('sample.gif')
    expect(magic.getMime(data)).toBe('image/gif')
  })

  test('detects WebP files', () => {
    const data = readFixture('sample.webp')
    expect(magic.getMime(data)).toBe('image/webp')
  })

  test('detects PDF files', () => {
    const data = readFixture('sample.pdf')
    expect(magic.getMime(data)).toBe('application/pdf')
  })

  test('detects ZIP files', () => {
    const data = readFixture('sample.zip')
    expect(magic.getMime(data)).toBe('application/zip')
  })

  test('detects plain text files', () => {
    const data = readFixture('sample.txt')
    expect(magic.getMime(data)).toBe('text/plain')
  })

  test('detects DOCX files (ZIP-based office format)', () => {
    const data = readFixture('DOCX_TestPage.docx')
    const mime = magic.getMime(data)
    // DOCX files are ZIP-based; wasmagic may detect as zip or as docx
    expect(
      mime === 'application/zip' ||
        mime ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ).toBe(true)
  })

  test('provides file description via detect()', () => {
    const data = readFixture('sample.png')
    const description = magic.detect(data)
    expect(description).toBeDefined()
    expect(description.length).toBeGreaterThan(0)
    expect(description.toLowerCase()).toContain('png')
  })

  test('detects from minimal headers when enough data is provided', () => {
    // wasmagic (libmagic) needs sufficient bytes beyond the header for
    // reliable detection. Real fixture files work; minimal headers may
    // fall back to application/octet-stream. Here we verify that
    // at least some common formats are detectable from small buffers.
    const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    expect(magic.getMime(jpegMagic)).toBe('image/jpeg')

    const pdfMagic = new TextEncoder().encode('%PDF-1.4')
    expect(magic.getMime(pdfMagic)).toBe('application/pdf')

    const gifMagic = new TextEncoder().encode('GIF89a')
    expect(magic.getMime(gifMagic)).toBe('image/gif')
  })
})
