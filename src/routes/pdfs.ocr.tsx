import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { pdfBaseName } from '@/lib/pdf-edit'

export const Route = createFileRoute('/pdfs/ocr')({
  component: PDFOCRRoute,
})

function PDFOCRRoute() {
  const { file, clearFiles } = usePDFSource()
  return (
    <PDFAction
      file={file}
      sourceKey={file?.name ?? ''}
      name="pdfs.edit.ocr"
      label="Make searchable and download"
      status="Opening your PDF…"
      onReset={clearFiles}
      run={async (signal, setStatus) => {
        if (!file) throw new Error('Choose a PDF first.')
        const { makeSearchablePDF } = await import('@/lib/pdf-privacy')
        const { blob, recognized } = await makeSearchablePDF(
          file,
          signal,
          setStatus,
        )
        return {
          blob,
          filename: recognized
            ? `${pdfBaseName(file.name)}-searchable.pdf`
            : file.name,
          details: [
            recognized
              ? `Added searchable text to ${recognized} ${recognized === 1 ? 'page' : 'pages'}.`
              : 'No new text was recognized. This is the original PDF.',
          ],
        }
      }}
    >
      <h2 className="text-lg font-semibold">Find text in scans</h2>
      <p className="text-sm text-muted-foreground">
        Recognizes English text on scanned pages and adds a selectable text
        layer. Pages with selectable text are kept as they are.
      </p>
      <p className="text-sm text-muted-foreground">
        Check the recognized text against your original. Blurry scans and
        handwriting can be harder to read.
      </p>
    </PDFAction>
  )
}
