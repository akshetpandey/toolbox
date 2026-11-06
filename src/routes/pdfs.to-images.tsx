import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, PDFPageRanges, usePDFSource } from '@/components/PDFAction'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { parsePageRanges, pdfBaseName } from '@/lib/pdf-edit'
import { exportPDFImages } from '@/lib/pdf-render'
import { Label } from '@/components/ui'

export const Route = createFileRoute('/pdfs/to-images')({
  component: PDFToImagesRoute,
})

function PDFToImagesRoute() {
  const { file, count, clearFiles } = usePDFSource()
  const [ranges, setRanges] = useWorkspaceState(
    'pdfs.edit.to-images.ranges',
    '',
  )
  const [format, setFormat] = useWorkspaceState<'jpg' | 'png'>(
    'pdfs.edit.to-images.format',
    'jpg',
  )
  const [scale, setScale] = useWorkspaceState('pdfs.edit.to-images.scale', 2)
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, ranges, format, scale])}
      name="pdfs.edit.to-images"
      label="Export pages"
      onReset={clearFiles}
      disabled={!count}
      run={async (signal, setStatus) => {
        if (!file || !count) throw new Error('Choose a readable PDF first.')
        const pages = parsePageRanges(ranges, count).flat()
        const blob = await exportPDFImages(
          file,
          pages,
          format,
          scale,
          signal,
          (index) => {
            setStatus(`Rendered ${index} of ${pages.length} pages…`)
          },
        )
        return {
          blob,
          filename: `${pdfBaseName(file.name)}-${pages.length === 1 ? `page-${pages[0] + 1}.${format}` : 'images.zip'}`,
          details: [
            `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} exported`,
          ],
        }
      }}
    >
      <h2 className="text-lg font-semibold">Save PDF pages as images</h2>
      <PDFPageRanges
        value={ranges}
        setValue={setRanges}
        hint="Enter pages such as 1-3, 5, or leave blank to export all pages. Multiple images download in a ZIP."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pdf-image-format">Image format</Label>
          <select
            id="pdf-image-format"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={format}
            onChange={(event) => setFormat(event.target.value as 'jpg' | 'png')}
          >
            <option value="jpg">JPG · smaller files</option>
            <option value="png">PNG · lossless quality</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdf-image-resolution">Resolution</Label>
          <select
            id="pdf-image-resolution"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          >
            <option value={1}>Standard</option>
            <option value={2}>High</option>
            <option value={3}>Very high</option>
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
