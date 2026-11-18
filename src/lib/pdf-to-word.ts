import { message } from '@/i18n/messages'
import type { LocalizedMessage } from '@/i18n/messages'
import { MessageError } from '@/i18n/MessageError'
import { openBrowserPDF } from './pdf-render'

export async function convertPDFToWord(
  file: File,
  signal: AbortSignal,
  onProgress: (message: LocalizedMessage) => void,
) {
  signal.throwIfAborted()
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const pdf = await openBrowserPDF(file)
  try {
    const paragraphs: InstanceType<typeof Paragraph>[] = []
    let emptyPages = 0

    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted()
      onProgress(
        message('pdfToWordReadingPage', { page: number, total: pdf.numPages }),
      )
      const page = await pdf.getPage(number)
      const { items } = await page.getTextContent()
      page.cleanup()

      const lines: string[] = []
      let line = ''
      for (const item of items) {
        if (!('str' in item)) continue
        line += item.str
        if (item.hasEOL) {
          lines.push(line.trimEnd())
          line = ''
        }
      }
      if (line.trim()) lines.push(line.trimEnd())
      if (!lines.some((text) => text.trim())) {
        emptyPages++
        continue
      }

      paragraphs.push(
        new Paragraph({
          pageBreakBefore: paragraphs.length > 0,
          children: lines.map(
            (text, index) =>
              new TextRun({ text, break: index ? 1 : undefined }),
          ),
        }),
      )
    }

    signal.throwIfAborted()
    if (!paragraphs.length) {
      throw new MessageError('pdfToWordThisPDFHasNoSelectableText')
    }
    onProgress(message('pdfToWordBuilding'))
    const blob = await Packer.toBlob(
      new Document({ sections: [{ children: paragraphs }] }),
    )
    signal.throwIfAborted()
    return {
      blob,
      filename: `${file.name.replace(/\.pdf$/iu, '')}.docx`,
      details: [
        message('pdfToWordEditableText'),
        ...(emptyPages
          ? [
              message(
                'pdfToWordSkippedPages',
                { count: emptyPages },
                emptyPages,
              ),
            ]
          : []),
      ],
    }
  } finally {
    await pdf.loadingTask.destroy()
  }
}
