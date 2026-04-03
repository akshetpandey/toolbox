import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestFile } from './helpers'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockCallMain, mockFs } = vi.hoisted(() => {
  const mockCallMain = vi.fn()
  const mockFs = {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
    isDir: vi.fn(),
  }
  return { mockCallMain, mockFs }
})

vi.mock('7z-wasm', () => ({
  default: vi.fn().mockResolvedValue({
    callMain: mockCallMain,
    FS: mockFs,
  }),
}))

import { ArchiveProcessor, type CompressionFormat } from '../archive'

let processor: ArchiveProcessor

beforeEach(() => {
  vi.clearAllMocks()
  mockCallMain.mockReturnValue(undefined)
  mockFs.readFile.mockReturnValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))
  mockFs.readdir.mockReturnValue(['.', '..'])
  mockFs.stat.mockReturnValue({ mode: 0o100644 })
  mockFs.isDir.mockReturnValue(false)

  processor = new ArchiveProcessor()
})

// ─── ArchiveProcessor.init ───────────────────────────────────────────────────

describe('ArchiveProcessor.init', () => {
  test('initializes 7z-wasm successfully', async () => {
    await expect(processor.init()).resolves.not.toThrow()
  })
})

// ─── ArchiveProcessor.compress ───────────────────────────────────────────────

describe('ArchiveProcessor.compress', () => {
  beforeEach(async () => {
    await processor.init()
  })

  test('compresses files to 7z by default', async () => {
    const files = [
      {
        file: createTestFile('hello.txt', 'Hello World', 'text/plain'),
        name: 'hello.txt',
        size: 11,
        type: 'text/plain',
      },
    ]

    const result = await processor.compress(files)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(mockFs.writeFile).toHaveBeenCalled()
    expect(mockCallMain).toHaveBeenCalled()
    const callArgs = mockCallMain.mock.calls[0][0] as string[]
    expect(callArgs).toContain('a')
  })

  test('compresses to each supported format', async () => {
    const files = [
      {
        file: createTestFile('data.txt', 'test data', 'text/plain'),
        name: 'data.txt',
        size: 9,
        type: 'text/plain',
      },
    ]

    const formats: CompressionFormat[] = ['zip', '7z', 'tar', 'gzip']

    for (const format of formats) {
      vi.clearAllMocks()
      mockCallMain.mockReturnValue(undefined)
      mockFs.readFile.mockReturnValue(new Uint8Array([1, 2, 3]))

      const result = await processor.compress(files, format)
      expect(result).toBeInstanceOf(Uint8Array)
    }
  })

  test('uses custom archive name', async () => {
    const files = [
      {
        file: createTestFile('a.txt', 'data', 'text/plain'),
        name: 'a.txt',
        size: 4,
        type: 'text/plain',
      },
    ]

    await processor.compress(files, 'zip', 'my-archive')

    const callArgs = mockCallMain.mock.calls[0][0] as string[]
    expect(callArgs.some((arg: string) => arg.includes('my-archive'))).toBe(true)
  })

  test('compresses multiple files', async () => {
    const files = [
      {
        file: createTestFile('a.txt', 'aaa', 'text/plain'),
        name: 'a.txt',
        size: 3,
        type: 'text/plain',
      },
      {
        file: createTestFile('b.txt', 'bbb', 'text/plain'),
        name: 'b.txt',
        size: 3,
        type: 'text/plain',
      },
      {
        file: createTestFile('c.txt', 'ccc', 'text/plain'),
        name: 'c.txt',
        size: 3,
        type: 'text/plain',
      },
    ]

    await processor.compress(files)

    expect(mockFs.writeFile).toHaveBeenCalledTimes(3)
  })

  test('calls onProgress callback', async () => {
    const onProgress = vi.fn()
    const files = [
      {
        file: createTestFile('a.txt', 'data', 'text/plain'),
        name: 'a.txt',
        size: 4,
        type: 'text/plain',
      },
    ]

    await processor.compress(files, 'zip', undefined, onProgress)

    expect(onProgress).toHaveBeenCalled()
  })

  test('handles gzip with tar intermediate step', async () => {
    const files = [
      {
        file: createTestFile('a.txt', 'data', 'text/plain'),
        name: 'a.txt',
        size: 4,
        type: 'text/plain',
      },
    ]

    await processor.compress(files, 'gzip')

    // Should call callMain twice: once for tar, once for gzip
    expect(mockCallMain).toHaveBeenCalledTimes(2)
    const tarArgs = mockCallMain.mock.calls[0][0] as string[]
    expect(tarArgs).toContain('-ttar')
    const gzipArgs = mockCallMain.mock.calls[1][0] as string[]
    expect(gzipArgs).toContain('-tgzip')
  })
})

// ─── ArchiveProcessor.decompress ─────────────────────────────────────────────

describe('ArchiveProcessor.decompress', () => {
  beforeEach(async () => {
    await processor.init()
  })

  test('extracts files from an archive', () => {
    // readdir for the extraction directory returns files
    mockFs.readdir.mockReturnValue(['.', '..', 'file1.txt', 'file2.txt'])
    mockFs.stat.mockReturnValue({ mode: 0o100644 })
    mockFs.isDir.mockReturnValue(false)
    mockFs.readFile.mockReturnValue(new Uint8Array([72, 101, 108, 108, 111]))

    const archiveData = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const result = processor.decompress(archiveData, 'test.zip')

    expect(result.length).toBe(2)
    expect(result[0].name).toBe('file1.txt')
    expect(result[0].data).toBeInstanceOf(Uint8Array)
    expect(result[0].isDirectory).toBe(false)
  })

  test('handles nested directories in archive', () => {
    mockFs.readdir
      .mockReturnValueOnce(['.', '..', 'subdir', 'root.txt'])
      .mockReturnValueOnce(['.', '..', 'nested.txt'])
    mockFs.stat.mockReturnValue({ mode: 0o100644 })
    // First entry is directory, rest are files
    mockFs.isDir
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
    mockFs.readFile.mockReturnValue(new Uint8Array([1, 2, 3]))

    const archiveData = new Uint8Array([0x50, 0x4b])
    const result = processor.decompress(archiveData, 'archive.zip')

    expect(result.length).toBeGreaterThan(0)
    // Should have a directory entry and file entries
    const dirs = result.filter((f) => f.isDirectory)
    const files = result.filter((f) => !f.isDirectory)
    expect(dirs.length).toBe(1)
    expect(files.length).toBeGreaterThanOrEqual(1)
  })

  test('calls onProgress callback', () => {
    mockFs.readdir.mockReturnValue(['.', '..', 'a.txt'])
    mockFs.stat.mockReturnValue({ mode: 0o100644 })
    mockFs.isDir.mockReturnValue(false)
    mockFs.readFile.mockReturnValue(new Uint8Array([1]))

    const onProgress = vi.fn()
    const archiveData = new Uint8Array([1, 2, 3])
    processor.decompress(archiveData, 'test.zip', onProgress)

    expect(onProgress).toHaveBeenCalledWith(25)
    expect(onProgress).toHaveBeenCalledWith(50)
    expect(onProgress).toHaveBeenCalledWith(75)
    expect(onProgress).toHaveBeenCalledWith(100)
  })

  test('handles extraction failure', () => {
    mockCallMain.mockImplementation(() => {
      throw new Error('Extraction error')
    })

    const archiveData = new Uint8Array([1, 2])
    expect(() =>
      processor.decompress(archiveData, 'bad.zip'),
    ).toThrow()
  })

  test('writes archive data to virtual filesystem before extraction', () => {
    mockFs.readdir.mockReturnValue(['.', '..'])
    mockFs.readFile.mockReturnValue(new Uint8Array([1]))

    const archiveData = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    processor.decompress(archiveData, 'test.zip')

    expect(mockFs.writeFile).toHaveBeenCalledWith('test.zip', archiveData)
  })

  test('calls callMain to list and extract archive', () => {
    mockFs.readdir.mockReturnValue(['.', '..'])

    const archiveData = new Uint8Array([1, 2, 3])
    processor.decompress(archiveData, 'test.zip')

    // Should list contents and then extract
    expect(mockCallMain).toHaveBeenCalledWith(['l', 'test.zip'])
    expect(mockCallMain).toHaveBeenCalledWith([
      'x',
      'test.zip',
      '-oextracted_files',
      '-y',
    ])
  })
})

// ─── archive.ts utility functions ────────────────────────────────────────────

import { formatFileSize, downloadFile as archiveDownloadFile } from '../archive'

describe('formatFileSize (archive)', () => {
  test('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  test('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
  })

  test('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1 MB')
  })
})

describe('downloadFile (archive)', () => {
  test('creates blob and triggers download', () => {
    const clickSpy = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
      style: {},
    } as unknown as HTMLAnchorElement)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
    const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock')
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURLSpy)
    const revokeObjectURLSpy = vi.fn()
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURLSpy)

    const data = new Uint8Array([1, 2, 3, 4])
    archiveDownloadFile(data, 'output.zip', 'application/zip')

    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalled()
  })
})
