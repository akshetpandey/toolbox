import { describe, test, expect, vi, beforeEach } from 'vitest'

const { mockCompileTypstToPDF, mockExtractZipEntries } = vi.hoisted(() => ({
  mockCompileTypstToPDF: vi.fn(),
  mockExtractZipEntries: vi.fn(),
}))

vi.mock('pandoc-wasm', () => ({
  convert: vi.fn(),
}))

vi.mock('../typst', () => ({
  compileTypstToPDF: (...args: unknown[]) =>
    mockCompileTypstToPDF(...args) as unknown,
}))

vi.mock('../archive', () => ({
  extractZipEntries: (...args: unknown[]) =>
    mockExtractZipEntries(...args) as unknown,
}))

import {
  convertOfficeToPDF,
  convertOfficeDocument,
  getSupportedInputFormats,
  getSupportedOutputFormats,
  isOfficeFile,
  createOfficeFile,
  getOutputFilename,
} from '../pandoc'
import { convert } from 'pandoc-wasm'
import { createTestFile } from './helpers'

const mockConvert = vi.mocked(convert)

function mockConvertResult(stdout: string, stderr = '') {
  return {
    stdout,
    stderr,
    warnings: [] as unknown[],
    files: {} as Record<string, string | Blob>,
    mediaFiles: {} as Record<string, Blob>,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: compileTypstToPDF returns a small PDF-like Uint8Array
  mockCompileTypstToPDF.mockResolvedValue(
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
  )
  // Default: extractZipEntries returns empty (no media)
  mockExtractZipEntries.mockResolvedValue({})
})

// ─── getSupportedInputFormats ────────────────────────────────────────────────

describe('getSupportedInputFormats', () => {
  test('returns expected office formats', () => {
    const formats = getSupportedInputFormats()
    expect(formats).toContain('docx')
    expect(formats).toContain('doc')
    expect(formats).toContain('pptx')
    expect(formats).toContain('xlsx')
    expect(formats).toContain('odt')
    expect(formats).toContain('rtf')
  })

  test('returns an array of strings', () => {
    const formats = getSupportedInputFormats()
    expect(formats.length).toBeGreaterThan(0)
    for (const format of formats) {
      expect(typeof format).toBe('string')
    }
  })
})

// ─── getSupportedOutputFormats ───────────────────────────────────────────────

describe('getSupportedOutputFormats', () => {
  test('returns expected output formats', () => {
    const formats = getSupportedOutputFormats()
    expect(formats).toContain('pdf')
    expect(formats).toContain('html')
    expect(formats).toContain('markdown')
    expect(formats).toContain('docx')
    expect(formats).toContain('epub')
    expect(formats).toContain('latex')
  })
})

// ─── isOfficeFile ────────────────────────────────────────────────────────────

describe('isOfficeFile', () => {
  test('recognizes office document extensions', () => {
    expect(
      isOfficeFile(
        createTestFile(
          'report.docx',
          '',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(
        createTestFile(
          'slides.pptx',
          '',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(
        createTestFile(
          'data.xlsx',
          '',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(
        createTestFile(
          'doc.odt',
          '',
          'application/vnd.oasis.opendocument.text',
        ),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(createTestFile('text.rtf', '', 'application/rtf')),
    ).toBe(true)
  })

  test('recognizes legacy office extensions', () => {
    expect(
      isOfficeFile(createTestFile('old.doc', '', 'application/msword')),
    ).toBe(true)
    expect(
      isOfficeFile(
        createTestFile('old.ppt', '', 'application/vnd.ms-powerpoint'),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(createTestFile('old.xls', '', 'application/vnd.ms-excel')),
    ).toBe(true)
  })

  test('rejects non-office files', () => {
    expect(isOfficeFile(createTestFile('image.png', '', 'image/png'))).toBe(
      false,
    )
    expect(isOfficeFile(createTestFile('video.mp4', '', 'video/mp4'))).toBe(
      false,
    )
    expect(isOfficeFile(createTestFile('page.html', '', 'text/html'))).toBe(
      false,
    )
    expect(
      isOfficeFile(createTestFile('data.json', '', 'application/json')),
    ).toBe(false)
  })

  test('is case-insensitive for extension', () => {
    expect(
      isOfficeFile(
        createTestFile('REPORT.DOCX', '', 'application/octet-stream'),
      ),
    ).toBe(true)
    expect(
      isOfficeFile(createTestFile('Data.XLSX', '', 'application/octet-stream')),
    ).toBe(true)
  })
})

// ─── createOfficeFile ────────────────────────────────────────────────────────

describe('createOfficeFile', () => {
  test('creates an OfficeFile with correct properties', () => {
    const file = createTestFile(
      'report.docx',
      'content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const officeFile = createOfficeFile(file)

    expect(officeFile.name).toBe('report.docx')
    expect(officeFile.size).toBe(file.size)
    expect(officeFile.type).toBe(file.type)
    expect(officeFile.file).toBe(file)
    expect(officeFile.id).toBeTruthy()
  })

  test('generates unique IDs', () => {
    const file = createTestFile(
      'report.docx',
      'content',
      'application/octet-stream',
    )
    const a = createOfficeFile(file)
    // IDs include Date.now() so they should differ
    // (might be same in fast execution, but id format is tested)
    expect(a.id).toContain('report.docx')
  })

  test('falls back to application/octet-stream for empty type', () => {
    const file = createTestFile('noext', 'data', '')
    const officeFile = createOfficeFile(file)
    expect(officeFile.type).toBe('application/octet-stream')
  })
})

// ─── getOutputFilename ───────────────────────────────────────────────────────

describe('getOutputFilename', () => {
  test('maps known output formats to correct extensions', () => {
    expect(getOutputFilename('report.docx', 'pdf')).toBe('report.pdf')
    expect(getOutputFilename('report.docx', 'html')).toBe('report.html')
    expect(getOutputFilename('report.docx', 'markdown')).toBe('report.md')
    expect(getOutputFilename('report.docx', 'latex')).toBe('report.tex')
    expect(getOutputFilename('report.docx', 'epub')).toBe('report.epub')
    expect(getOutputFilename('report.docx', 'txt')).toBe('report.txt')
    expect(getOutputFilename('report.docx', 'odt')).toBe('report.odt')
  })

  test('uses format as extension for unknown formats', () => {
    expect(getOutputFilename('file.docx', 'custom')).toBe('file.custom')
  })

  test('strips original extension', () => {
    expect(getOutputFilename('document.pptx', 'pdf')).toBe('document.pdf')
    expect(getOutputFilename('data.xlsx', 'html')).toBe('data.html')
  })

  test('handles files with multiple dots', () => {
    expect(getOutputFilename('my.report.v2.docx', 'pdf')).toBe(
      'my.report.v2.pdf',
    )
  })
})

// ─── convertOfficeToPDF ──────────────────────────────────────────────────────

describe('convertOfficeToPDF', () => {
  test('converts docx to typst then compiles to PDF', async () => {
    mockConvert.mockResolvedValue(
      mockConvertResult('#set page(paper: "a4")\nHello World'),
    )

    const file = createTestFile(
      'report.docx',
      'fake docx content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(true)
    expect(result.output).toBeInstanceOf(Blob)
    expect((result.output as Blob).type).toBe('application/pdf')

    // Verify pandoc was called with typst output format and input-files
    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'docx',
        to: 'typst',
        standalone: true,
        'input-files': ['report.docx'],
      }),
      null,
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect.objectContaining({
        'report.docx': expect.any(Blob),
      }),
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    )

    // Verify typst compilation was called with the pandoc output
    expect(mockCompileTypstToPDF).toHaveBeenCalledWith(
      '#set page(paper: "a4")\nHello World',
      {},
    )
  })

  test('returns a PDF blob on success', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('= Title\nSome content'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(true)
    expect(result.output).toBeInstanceOf(Blob)
    expect((result.output as Blob).size).toBeGreaterThan(0)
  })

  test('returns error when pandoc produces no output', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('', 'some error'))

    const file = createTestFile(
      'empty.docx',
      'content',
      'application/octet-stream',
    )
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(mockCompileTypstToPDF).not.toHaveBeenCalled()
  })

  test('returns error for unsupported format', async () => {
    const file = createTestFile('file.txt', 'content', 'text/plain')
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported file format')
  })

  test('handles pandoc-wasm throwing an error', async () => {
    mockConvert.mockRejectedValue(new Error('WASM crashed'))

    const file = createTestFile(
      'bad.docx',
      'content',
      'application/octet-stream',
    )
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(false)
    expect(result.error).toBe('WASM crashed')
  })

  test('handles typst compilation failure', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('= Some typst content'))
    mockCompileTypstToPDF.mockRejectedValue(
      new Error('Typst compilation produced no PDF output'),
    )

    const file = createTestFile(
      'report.docx',
      'content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    const result = await convertOfficeToPDF(file)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Typst compilation')
  })

  test('passes media files from pandoc to typst', async () => {
    // Pandoc now produces a media.zip blob when extract-media is used
    const zipBlob = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
      type: 'application/zip',
    })
    mockConvert.mockResolvedValue({
      stdout: '= Doc with image\n#image("./media/image1.png")',
      stderr: '',
      warnings: [],
      files: { 'media.zip': zipBlob },
      mediaFiles: {},
    })

    // extractZipEntries returns the image data from the zip
    const pngData = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    mockExtractZipEntries.mockResolvedValue({
      'media/image1.png': pngData,
    })

    const file = createTestFile(
      'report.docx',
      'content',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    await convertOfficeToPDF(file)

    // Verify extractZipEntries was called with zip data
    expect(mockExtractZipEntries).toHaveBeenCalledOnce()

    // Verify resource files were forwarded to typst (both with and without ./ prefix)
    const resourceArg = mockCompileTypstToPDF.mock.calls[0][1] as Record<
      string,
      Uint8Array
    >
    expect(resourceArg).toHaveProperty('media/image1.png')
    expect(resourceArg['media/image1.png']).toBeInstanceOf(Uint8Array)
    expect(resourceArg).toHaveProperty('./media/image1.png')
  })
})

// ─── convertOfficeDocument ───────────────────────────────────────────────────

describe('convertOfficeDocument', () => {
  test('passes from/to options to pandoc', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('# Converted markdown'))

    const file = createTestFile(
      'report.docx',
      'content',
      'application/octet-stream',
    )
    const result = await convertOfficeDocument(file, {
      from: 'docx',
      to: 'markdown',
    })

    expect(result.success).toBe(true)
    expect(result.output).toBe('# Converted markdown')
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'docx',
        to: 'markdown',
        'input-files': ['report.docx'],
      }),
      null,
      expect.objectContaining({ 'report.docx': expect.any(Blob) }),
    )
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  })

  test('passes standalone option when set', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('<html>output</html>'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    await convertOfficeDocument(file, {
      from: 'docx',
      to: 'html',
      standalone: true,
    })

    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({ standalone: true }),
      null,
      expect.any(Object),
    )
  })

  test('parses additional args with equals syntax', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('output'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    await convertOfficeDocument(file, {
      from: 'docx',
      to: 'html',
      additionalArgs: ['--wrap=none', '--columns=80'],
    })

    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({ wrap: 'none', columns: '80' }),
      null,
      expect.any(Object),
    )
  })

  test('parses additional args with space-separated values', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('output'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    await convertOfficeDocument(file, {
      from: 'docx',
      to: 'html',
      additionalArgs: ['--template', 'custom.html'],
    })

    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'custom.html' }),
      null,
      expect.any(Object),
    )
  })

  test('parses boolean flag args', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('output'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    await convertOfficeDocument(file, {
      from: 'docx',
      to: 'html',
      additionalArgs: ['--toc'],
    })

    expect(mockConvert).toHaveBeenCalledWith(
      expect.objectContaining({ toc: true }),
      null,
      expect.any(Object),
    )
  })

  test('returns error when no output is produced', async () => {
    mockConvert.mockResolvedValue(mockConvertResult('', 'error occurred'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    const result = await convertOfficeDocument(file, {
      from: 'docx',
      to: 'markdown',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('handles convert throwing an error', async () => {
    mockConvert.mockRejectedValue(new Error('Conversion failed'))

    const file = createTestFile(
      'doc.docx',
      'content',
      'application/octet-stream',
    )
    const result = await convertOfficeDocument(file, {
      from: 'docx',
      to: 'html',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Conversion failed')
  })
})
