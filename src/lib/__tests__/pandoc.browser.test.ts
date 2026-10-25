import { expect, test } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { convertOfficeToPDF } from '../pandoc'

// Exercise the browser entry points and asset loading that Node tests bypass.
test('converts a DOCX with embedded images to PDF in the browser', async () => {
  const response = await fetch(
    new URL('./fixtures/DOCX_TestPage.docx', import.meta.url),
  )
  expect(response.ok).toBe(true)
  const file = new File([await response.arrayBuffer()], 'DOCX_TestPage.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  const result = await convertOfficeToPDF(file)
  if (!result.success || !(result.output instanceof Blob)) {
    throw new Error(result.error ?? 'Expected a PDF blob')
  }

  expect(result.output.type).toBe('application/pdf')
  const pdf = await PDFDocument.load(await result.output.arrayBuffer())
  expect(pdf.getPageCount()).toBeGreaterThan(0)
})
