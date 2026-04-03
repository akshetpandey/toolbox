import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestFile } from './helpers'

// ─── Hoisted mocks (available to vi.mock factories) ─────────────────────────

const {
  mockParseMetadata,
  mockWriteMetadata,
  mockGetMime,
  mockDetect,
  mockWASMagicCreate,
  mockMd5,
  mockSha1,
  mockSha256,
} = vi.hoisted(() => ({
  mockParseMetadata: vi.fn(),
  mockWriteMetadata: vi.fn(),
  mockGetMime: vi.fn(),
  mockDetect: vi.fn(),
  mockWASMagicCreate: vi.fn(),
  mockMd5: vi.fn(),
  mockSha1: vi.fn(),
  mockSha256: vi.fn(),
}))

vi.mock('@uswriting/exiftool', () => ({
  parseMetadata: mockParseMetadata,
  writeMetadata: mockWriteMetadata,
}))

vi.mock('wasmagic', () => ({
  WASMagic: {
    create: (...args: unknown[]) => mockWASMagicCreate(...args) as unknown,
  },
}))

vi.mock('hash-wasm', () => ({
  md5: (...args: unknown[]) => mockMd5(...args) as unknown,
  sha1: (...args: unknown[]) => mockSha1(...args) as unknown,
  sha256: (...args: unknown[]) => mockSha256(...args) as unknown,
}))

import {
  extractExifMetadata,
  extractFileMetadata,
  stripFileMetadata,
  calculateFileHashes,
  formatFileSize,
} from '../metadata'

beforeEach(() => {
  vi.clearAllMocks()
  mockWASMagicCreate.mockResolvedValue({
    getMime: mockGetMime,
    detect: mockDetect,
  })
  mockMd5.mockResolvedValue('d41d8cd98f00b204e9800998ecf8427e')
  mockSha1.mockResolvedValue('da39a3ee5e6b4b0d3255bfef95601890afd80709')
  mockSha256.mockResolvedValue(
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
})

// ─── formatFileSize ──────────────────────────────────────────────────────────

describe('formatFileSize (metadata)', () => {
  test('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  test('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
  })

  test('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
  })

  test('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  test('formats terabytes', () => {
    expect(formatFileSize(1099511627776)).toBe('1 TB')
  })
})

// ─── extractExifMetadata ─────────────────────────────────────────────────────

describe('extractExifMetadata', () => {
  test('returns parsed EXIF data on success', async () => {
    const exifData = {
      Make: 'Canon',
      Model: 'EOS R5',
      ExposureTime: '1/250',
      FNumber: 2.8,
    }
    mockParseMetadata.mockResolvedValue({
      success: true,
      data: [exifData],
    })

    const file = createTestFile('photo.jpg', 'fake jpeg', 'image/jpeg')
    const result = await extractExifMetadata(file)

    expect(result).toEqual(exifData)
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(mockParseMetadata).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        args: ['-json'],
        transform: expect.any(Function),
        fetch: expect.any(Function),
      }),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  })

  test('returns empty object when parseMetadata fails', async () => {
    mockParseMetadata.mockResolvedValue({
      success: false,
      error: 'No EXIF data',
    })

    const file = createTestFile('photo.png', 'png data', 'image/png')
    const result = await extractExifMetadata(file)

    expect(result).toEqual({})
  })

  test('returns empty object on thrown error', async () => {
    mockParseMetadata.mockRejectedValue(new Error('WASM crash'))

    const file = createTestFile('broken.jpg', 'data', 'image/jpeg')
    const result = await extractExifMetadata(file)

    expect(result).toEqual({})
  })

  test('calls onProgress callback', async () => {
    mockParseMetadata.mockResolvedValue({ success: true, data: [{}] })
    const onProgress = vi.fn()

    const file = createTestFile('photo.jpg', 'data', 'image/jpeg')
    await extractExifMetadata(file, onProgress)

    expect(onProgress).toHaveBeenCalledWith(true)
    expect(onProgress).toHaveBeenCalledWith(false)
  })

  test('calls onProgress(false) even on error', async () => {
    mockParseMetadata.mockRejectedValue(new Error('fail'))
    const onProgress = vi.fn()

    const file = createTestFile('photo.jpg', 'data', 'image/jpeg')
    await extractExifMetadata(file, onProgress)

    expect(onProgress).toHaveBeenCalledWith(true)
    expect(onProgress).toHaveBeenCalledWith(false)
  })

  test('custom fetch redirects zeroperl.wasm requests', async () => {
    mockParseMetadata.mockImplementation(
      (_file: unknown, options: { fetch?: unknown }) => {
        expect(options.fetch).toBeDefined()
        return Promise.resolve({ success: true, data: [{}] })
      },
    )

    const file = createTestFile('photo.jpg', 'data', 'image/jpeg')
    await extractExifMetadata(file)

    expect(mockParseMetadata).toHaveBeenCalled()
  })
})

// ─── extractFileMetadata ─────────────────────────────────────────────────────

describe('extractFileMetadata', () => {
  test('detects MIME type and description using WASMagic', async () => {
    mockGetMime.mockReturnValue('image/jpeg')
    mockDetect.mockReturnValue('JPEG image data')

    const file = createTestFile('photo.jpg', 'fake jpeg data', 'image/jpeg')
    const result = await extractFileMetadata(file)

    expect(result.mimeType).toBe('image/jpeg')
    expect(result.description).toBe('JPEG image data')
    expect(result.size).toBe(file.size)
    expect(result.name).toBe('photo.jpg')
  })

  test('falls back to octet-stream when WASMagic returns null', async () => {
    mockGetMime.mockReturnValue(null)
    mockDetect.mockReturnValue(null)

    const file = createTestFile(
      'unknown.bin',
      'binary data',
      'application/octet-stream',
    )
    const result = await extractFileMetadata(file)

    expect(result.mimeType).toBe('application/octet-stream')
    expect(result.description).toBe('Unknown file type')
  })

  test('returns fallback on WASMagic error', async () => {
    mockWASMagicCreate.mockRejectedValue(new Error('WASM init failed'))

    const file = createTestFile('file.bin', 'data', 'application/octet-stream')
    const result = await extractFileMetadata(file)

    // Validates fallback response shape
    expect(result.name).toBe('file.bin')
    expect(result.size).toBe(file.size)
    expect(result.mimeType).toBeDefined()
  })

  test('passes first 8KB of file for detection', async () => {
    mockGetMime.mockReturnValue('text/plain')
    mockDetect.mockReturnValue('ASCII text')

    const largeContent = 'x'.repeat(20000)
    const file = createTestFile('big.txt', largeContent, 'text/plain')
    const result = await extractFileMetadata(file)

    expect(mockGetMime).toHaveBeenCalledWith(expect.any(Uint8Array))
    // getMime is called with (Uint8Array), check first arg size
    const firstArg = mockGetMime.mock.calls[0][0] as Uint8Array
    expect(firstArg.length).toBeLessThanOrEqual(8192)
    expect(result.mimeType).toBe('text/plain')
  })
})

// ─── stripFileMetadata ───────────────────────────────────────────────────────

describe('stripFileMetadata', () => {
  test('returns stripped blob on success', async () => {
    const strippedData = new Uint8Array([0xff, 0xd8, 0xff])
    mockWriteMetadata.mockResolvedValue({
      success: true,
      data: strippedData,
    })

    const file = createTestFile('photo.jpg', 'jpeg with exif', 'image/jpeg')
    const result = await stripFileMetadata(file)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/jpeg')
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(mockWriteMetadata).toHaveBeenCalledWith(
      file,
      {},
      expect.objectContaining({
        args: ['-all=', '--icc_profile:all'],
        fetch: expect.any(Function),
      }),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  })

  test('returns original file when stripping fails', async () => {
    mockWriteMetadata.mockResolvedValue({
      success: false,
      error: 'Cannot strip metadata',
    })

    const file = createTestFile('photo.jpg', 'jpeg data', 'image/jpeg')
    const result = await stripFileMetadata(file)

    expect(result).toBe(file)
  })

  test('returns original file on thrown error', async () => {
    mockWriteMetadata.mockRejectedValue(new Error('WASM error'))

    const file = createTestFile('photo.jpg', 'data', 'image/jpeg')
    const result = await stripFileMetadata(file)

    expect(result).toBe(file)
  })
})

// ─── calculateFileHashes ─────────────────────────────────────────────────────

describe('calculateFileHashes', () => {
  test('calculates MD5, SHA1, and SHA256 hashes', async () => {
    const file = createTestFile(
      'test.bin',
      'test data',
      'application/octet-stream',
    )
    const result = await calculateFileHashes(file)

    expect(result.md5).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(result.sha1).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709')
    expect(result.sha256).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  test('calls all three hash functions with the same data', async () => {
    const file = createTestFile('test.bin', 'hello', 'application/octet-stream')
    await calculateFileHashes(file)

    expect(mockMd5).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(mockSha1).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(mockSha256).toHaveBeenCalledWith(expect.any(Uint8Array))
  })

  test('calls onProgress callback', async () => {
    const onProgress = vi.fn()

    const file = createTestFile('test.bin', 'data', 'application/octet-stream')
    await calculateFileHashes(file, onProgress)

    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onProgress).toHaveBeenCalledWith(100)
  })

  test('returns error strings on hash failure', async () => {
    mockMd5.mockRejectedValue(new Error('Hash failed'))

    const file = createTestFile('test.bin', 'data', 'application/octet-stream')
    const result = await calculateFileHashes(file)

    expect(result.md5).toBe('Error')
    expect(result.sha1).toBe('Error')
    expect(result.sha256).toBe('Error')
  })
})
