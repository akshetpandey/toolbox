import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createTestFile } from './helpers'

// Use vi.hoisted() so these are available when vi.mock() factory runs (it's hoisted)
const { mockPage, mockMergedPdf, mockLoadedPdf } = vi.hoisted(() => {
  const mockPage = { fake: 'page' }
  const mockMergedPdf = {
    copyPages: vi.fn().mockResolvedValue([mockPage]),
    addPage: vi.fn(),
    save: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
    getPageIndices: vi.fn().mockReturnValue([0]),
  }
  const mockLoadedPdf = {
    getPageIndices: vi.fn().mockReturnValue([0, 1]),
  }
  return { mockPage, mockMergedPdf, mockLoadedPdf }
})

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn().mockResolvedValue(mockMergedPdf),
    load: vi.fn().mockResolvedValue(mockLoadedPdf),
  },
}))

import { mergePDFs, isPDFFile, createPDFFile, type PDFFile } from '../pdf'

beforeEach(() => {
  vi.clearAllMocks()
  mockMergedPdf.copyPages.mockResolvedValue([mockPage])
  mockMergedPdf.save.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]))
  mockLoadedPdf.getPageIndices.mockReturnValue([0, 1])
})

// ─── isPDFFile ───────────────────────────────────────────────────────────────

describe('isPDFFile', () => {
  test('accepts files with application/pdf MIME type', () => {
    expect(isPDFFile(createTestFile('doc.pdf', '', 'application/pdf'))).toBe(true)
  })

  test('accepts files with .pdf extension regardless of MIME type', () => {
    expect(isPDFFile(createTestFile('doc.pdf', '', 'application/octet-stream'))).toBe(true)
    expect(isPDFFile(createTestFile('doc.pdf', '', ''))).toBe(true)
  })

  test('rejects non-PDF files', () => {
    expect(isPDFFile(createTestFile('image.png', '', 'image/png'))).toBe(false)
    expect(isPDFFile(createTestFile('doc.docx', '', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(false)
    expect(isPDFFile(createTestFile('file.txt', '', 'text/plain'))).toBe(false)
  })

  test('handles case-insensitive extension', () => {
    expect(isPDFFile(createTestFile('DOC.PDF', '', ''))).toBe(true)
    expect(isPDFFile(createTestFile('file.Pdf', '', ''))).toBe(true)
  })
})

// ─── createPDFFile ───────────────────────────────────────────────────────────

describe('createPDFFile', () => {
  test('creates a PDFFile with correct properties', () => {
    const file = createTestFile('report.pdf', 'fake pdf content', 'application/pdf')
    const pdfFile = createPDFFile(file)

    expect(pdfFile.name).toBe('report.pdf')
    expect(pdfFile.size).toBe(file.size)
    expect(pdfFile.file).toBe(file)
    expect(pdfFile.id).toBeTruthy()
    expect(pdfFile.id).toContain('report.pdf')
  })

  test('generates IDs that include filename and size', () => {
    const file = createTestFile('doc.pdf', 'x'.repeat(100), 'application/pdf')
    const pdfFile = createPDFFile(file)
    expect(pdfFile.id).toContain('doc.pdf')
    expect(pdfFile.id).toContain(String(file.size))
  })
})

// ─── mergePDFs ───────────────────────────────────────────────────────────────

describe('mergePDFs', () => {
  function makePDFFile(name: string): PDFFile {
    return {
      id: `${name}-123-${Date.now()}`,
      file: createTestFile(name, 'fake pdf', 'application/pdf'),
      name,
      size: 8,
    }
  }

  test('requires at least 2 files', async () => {
    const result = await mergePDFs({ files: [makePDFFile('one.pdf')] })
    expect(result.success).toBe(false)
    expect(result.error).toContain('At least 2')
  })

  test('returns error for empty file list', async () => {
    const result = await mergePDFs({ files: [] })
    expect(result.success).toBe(false)
  })

  test('merges two PDF files successfully', async () => {
    const files = [makePDFFile('a.pdf'), makePDFFile('b.pdf')]
    const result = await mergePDFs({ files })

    expect(result.success).toBe(true)
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob!.type).toBe('application/pdf')
  })

  test('copies pages from each input PDF', async () => {
    const files = [makePDFFile('a.pdf'), makePDFFile('b.pdf'), makePDFFile('c.pdf')]
    await mergePDFs({ files })

    // Should load and copy pages from each file
    expect(mockMergedPdf.copyPages).toHaveBeenCalledTimes(3)
    expect(mockMergedPdf.addPage).toHaveBeenCalledTimes(3) // one page each
  })

  test('calls onFileProcessed callback for each file', async () => {
    const onFileProcessed = vi.fn()
    const files = [makePDFFile('a.pdf'), makePDFFile('b.pdf')]
    await mergePDFs({ files, onFileProcessed })

    expect(onFileProcessed).toHaveBeenCalledTimes(2)
    expect(onFileProcessed).toHaveBeenCalledWith(0, 'a.pdf', 1)
    expect(onFileProcessed).toHaveBeenCalledWith(1, 'b.pdf', 1)
  })

  test('handles pdf-lib errors gracefully', async () => {
    mockMergedPdf.save.mockRejectedValue(new Error('Save failed'))

    const files = [makePDFFile('a.pdf'), makePDFFile('b.pdf')]
    const result = await mergePDFs({ files })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Save failed')
  })

  test('produces a non-empty output blob', async () => {
    const files = [makePDFFile('a.pdf'), makePDFFile('b.pdf')]
    const result = await mergePDFs({ files })

    expect(result.blob!.size).toBeGreaterThan(0)
  })
})
