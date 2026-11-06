import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { convertPDFToWord } from '@/lib/pdf-to-word'

export const Route = createFileRoute('/pdfs/to-word')({
  component: PDFToWord,
})

function PDFToWord() {
  const { file, clearFiles } = usePDFSource()
  return (
    <PDFAction
      file={file}
      sourceKey={file?.name ?? ''}
      name="pdfs.edit.to-word"
      label="Export to Word"
      onReset={clearFiles}
      run={(signal, onProgress) => convertPDFToWord(file!, signal, onProgress)}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Export editable text</h2>
        <p className="text-sm text-muted-foreground">
          The Word document contains selectable text from the PDF. Complex
          layouts, images, and tables may need to be recreated in Word.
        </p>
      </div>
    </PDFAction>
  )
}
