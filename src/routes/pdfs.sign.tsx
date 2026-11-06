import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { Input, Label } from '@/components/ui'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { pdfBaseName } from '@/lib/pdf-edit'
import { stampPDF } from '@/lib/pdf-stamp'

export const Route = createFileRoute('/pdfs/sign')({
  component: PDFSignRoute,
})

function PDFSignRoute() {
  const { file, count, clearFiles } = usePDFSource()
  const [name, setName] = useWorkspaceState('pdfs.edit.sign.name', '')
  const [page, setPage] = useWorkspaceState('pdfs.edit.sign.page', '')
  const [side, setSide] = useWorkspaceState<'left' | 'right'>(
    'pdfs.edit.sign.side',
    'right',
  )
  const selected = page ? Number(page) : (count ?? 0)
  const validPage =
    Number.isInteger(selected) && selected >= 1 && selected <= (count ?? 0)
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, name, page, side])}
      name="pdfs.edit.sign"
      label="Add signature and download"
      onReset={clearFiles}
      disabled={!name.trim() || !validPage}
      run={async () => {
        if (!file) throw new Error('Choose a PDF first.')
        return {
          blob: await stampPDF(file, {
            type: 'signature',
            text: name,
            page: selected,
            side,
          }),
          filename: `${pdfBaseName(file.name)}-signed.pdf`,
          details: [`Typed signature on page ${selected}`],
        }
      }}
    >
      <h2 className="text-lg font-semibold">Add a visible typed signature</h2>
      <p className="text-sm text-muted-foreground">
        Place your name at the bottom of a page as a visual signature.
      </p>
      <div className="space-y-2">
        <Label htmlFor="pdf-signature-name">Signature name</Label>
        <Input
          id="pdf-signature-name"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="font-serif italic"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pdf-signature-page">Page</Label>
          <Input
            id="pdf-signature-page"
            type="number"
            min={1}
            max={count ?? undefined}
            placeholder={count ? `Last page (${count})` : 'Last page'}
            value={page}
            onChange={(event) => setPage(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdf-signature-side">Position</Label>
          <select
            id="pdf-signature-side"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={side}
            onChange={(event) =>
              setSide(event.target.value as 'left' | 'right')
            }
          >
            <option value="right">Bottom right</option>
            <option value="left">Bottom left</option>
          </select>
        </div>
      </div>
      {count === null && (
        <p role="alert" className="text-sm text-destructive">
          Choose a readable, unlocked PDF.
        </p>
      )}
    </PDFAction>
  )
}
