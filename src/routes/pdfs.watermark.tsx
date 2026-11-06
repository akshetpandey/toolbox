import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { Input, Label } from '@/components/ui'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { pdfBaseName } from '@/lib/pdf-edit'
import { stampPDF } from '@/lib/pdf-stamp'

export const Route = createFileRoute('/pdfs/watermark')({
  component: PDFWatermarkRoute,
})

function PDFWatermarkRoute() {
  const { file, clearFiles } = usePDFSource()
  const [text, setText] = useWorkspaceState('pdfs.edit.watermark.text', '')
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, text])}
      name="pdfs.edit.watermark"
      label="Add watermark and download"
      onReset={clearFiles}
      disabled={!text.trim()}
      run={async () => {
        if (!file) throw new Error('Choose a PDF first.')
        return {
          blob: await stampPDF(file, { type: 'watermark', text }),
          filename: `${pdfBaseName(file.name)}-watermarked.pdf`,
          details: ['Watermark applied to all pages'],
        }
      }}
    >
      <h2 className="text-lg font-semibold">Mark every page</h2>
      <p className="text-sm text-muted-foreground">
        Your text appears diagonally across every page in translucent gray.
      </p>
      <div className="space-y-2">
        <Label htmlFor="pdf-watermark-text">Watermark text</Label>
        <Input
          id="pdf-watermark-text"
          placeholder="Draft"
          value={text}
          maxLength={80}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
    </PDFAction>
  )
}
