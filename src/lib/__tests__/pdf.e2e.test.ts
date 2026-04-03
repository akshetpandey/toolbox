// @vitest-environment node

/**
 * E2E tests for pdf-lib PDF operations.
 * These tests use the real pdf-lib library to create and merge PDFs.
 */
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PDFDocument } from 'pdf-lib'

const fixturesDir = resolve(__dirname, 'fixtures')

describe('pdf-lib (e2e)', () => {
  test('creates a PDF document from scratch', async () => {
    const pdf = await PDFDocument.create()
    const page = pdf.addPage([612, 792]) // US Letter
    page.drawText('Hello from pdf-lib!', { x: 50, y: 700 })
    const bytes = await pdf.save()

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(100)

    // Verify PDF header
    expect(bytes[0]).toBe(0x25) // %
    expect(bytes[1]).toBe(0x50) // P
    expect(bytes[2]).toBe(0x44) // D
    expect(bytes[3]).toBe(0x46) // F
  })

  test('loads and reads an existing PDF', async () => {
    const pdfBytes = readFileSync(resolve(fixturesDir, 'sample.pdf'))
    const pdf = await PDFDocument.load(pdfBytes)

    expect(pdf.getPageCount()).toBeGreaterThan(0)
    const [width, height] = [
      pdf.getPage(0).getWidth(),
      pdf.getPage(0).getHeight(),
    ]
    expect(width).toBeGreaterThan(0)
    expect(height).toBeGreaterThan(0)
  })

  test('merges two PDF documents', async () => {
    // Create two small PDFs
    const pdf1 = await PDFDocument.create()
    pdf1.addPage([612, 792])
    const bytes1 = await pdf1.save()

    const pdf2 = await PDFDocument.create()
    pdf2.addPage([612, 792])
    pdf2.addPage([612, 792])
    const bytes2 = await pdf2.save()

    // Merge them
    const merged = await PDFDocument.create()
    const doc1 = await PDFDocument.load(bytes1)
    const doc2 = await PDFDocument.load(bytes2)

    const pages1 = await merged.copyPages(doc1, doc1.getPageIndices())
    for (const page of pages1) merged.addPage(page)

    const pages2 = await merged.copyPages(doc2, doc2.getPageIndices())
    for (const page of pages2) merged.addPage(page)

    const mergedBytes = await merged.save()

    // Load and verify
    const result = await PDFDocument.load(mergedBytes)
    expect(result.getPageCount()).toBe(3) // 1 + 2 pages
  })
})
