import { openBrowserPDF } from './pdf-render'

export async function convertPDFToWord(
  file: File,
  signal: AbortSignal,
  onProgress: (message: string) => void,
) {
  signal.throwIfAborted()
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const pdf = await openBrowserPDF(file)
  try {
    const paragraphs: InstanceType<typeof Paragraph>[] = []
    let emptyPages = 0

    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted()
      onProgress(`Reading page ${number} of ${pdf.numPages}…`)
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
      throw new Error(
        'This PDF has no selectable text. Try Make PDF searchable first.',
      )
    }
    onProgress('Building the Word document…')
    const blob = await Packer.toBlob(
      new Document({ sections: [{ children: paragraphs }] }),
    )
    signal.throwIfAborted()
    return {
      blob,
      filename: `${file.name.replace(/\.pdf$/iu, '')}.docx`,
      details: [
        'Editable text',
        ...(emptyPages
          ? [
              `Skipped ${emptyPages} ${emptyPages === 1 ? 'page' : 'pages'} with no selectable text`,
            ]
          : []),
      ],
    }
  } finally {
    await pdf.loadingTask.destroy()
  }
}
