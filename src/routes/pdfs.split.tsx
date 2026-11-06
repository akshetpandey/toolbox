import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, PDFPageRanges, usePDFSource } from '@/components/PDFAction'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { extractPDFPages, pdfBaseName } from '@/lib/pdf-edit'
import { Label } from '@/components/ui'

export const Route = createFileRoute('/pdfs/split')({
  component: PDFSplitRoute,
})

function PDFSplitRoute() {
  const { file, count, clearFiles } = usePDFSource()
  const [ranges, setRanges] = useWorkspaceState('pdfs.edit.split.ranges', '')
  const [separate, setSeparate] = useWorkspaceState(
    'pdfs.edit.split.separate',
    false,
  )
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, ranges, separate])}
      name="pdfs.edit.split"
      label={separate ? 'Split and download ZIP' : 'Extract and download PDF'}
      onReset={clearFiles}
      run={async (signal) => {
        if (!file) throw new Error('Choose a PDF first.')
        const result = await extractPDFPages(file, ranges, separate, signal)
        return {
          blob: result.blob,
          filename: `${pdfBaseName(file.name)}-${separate ? 'parts' : 'pages'}.${result.extension}`,
          details: [
            `${result.count} ${separate ? 'PDFs in the ZIP' : 'pages selected'}`,
          ],
        }
      }}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Choose which pages to keep</h2>
        <p className="text-sm text-muted-foreground">
          {typeof count === 'number'
            ? `Your document has ${count} ${count === 1 ? 'page' : 'pages'}.`
            : 'Choose one PDF to get started.'}
        </p>
      </div>
      <PDFPageRanges
        value={ranges}
        setValue={setRanges}
        hint={
          separate
            ? 'For example, 1-3, 5 creates two PDFs. Leave blank for one PDF per page.'
            : 'For example, 1-3, 5 saves pages 1 through 3 and page 5 in one PDF.'
        }
      />
      <Label
        htmlFor="pdf-split-output"
        className="flex min-h-11 items-center gap-2"
      >
        <input
          id="pdf-split-output"
          type="checkbox"
          checked={separate}
          onChange={(event) => setSeparate(event.target.checked)}
        />
        Save each range as a separate PDF
      </Label>
    </PDFAction>
  )
}
