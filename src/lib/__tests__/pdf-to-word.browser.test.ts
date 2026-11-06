import { expect, test, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { strFromU8, unzipSync } from 'fflate'
import { convertPDFToWord } from '../pdf-to-word'

test('exports selectable PDF text to a local DOCX and reports skipped pages', async () => {
  const pdf = await PDFDocument.create()
  pdf.addPage().drawText('First page with editable text')
  pdf.addPage()
  pdf.addPage().drawText('Third page with editable text')
  const file = new File([(await pdf.save()).slice()], 'sample.pdf')
  const result = await convertPDFToWord(
    file,
    new AbortController().signal,
    vi.fn(),
  )

  expect(result.filename).toBe('sample.docx')
  expect(result.details).toContain('Skipped 1 page with no selectable text')
  const files = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
  const document = strFromU8(files['word/document.xml'])
  expect(document).toContain('First page with editable text')
  expect(document).toContain('Third page with editable text')
})
