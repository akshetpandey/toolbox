import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { compressPDF, type PDFCompressionMode } from '@/lib/pdf-compress'
import { pdfBaseName } from '@/lib/pdf-edit'
import { Label } from '@/components/ui'

export const Route = createFileRoute('/pdfs/compress')({
  component: PDFCompressRoute,
})

function PDFCompressRoute() {
  const { file, clearFiles } = usePDFSource()
  const [mode, setMode] = useWorkspaceState<PDFCompressionMode>(
    'pdfs.edit.compress.mode',
    'lossless',
  )
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, mode])}
      name="pdfs.edit.compress"
      label="Compress and download"
      onReset={clearFiles}
      run={async (signal) => {
        if (!file) throw new Error('Choose a PDF first.')
        const blob = await compressPDF(file, mode, signal)
        return {
          blob,
          sourceSize: file.size,
          filename:
            blob === file
              ? file.name
              : `${pdfBaseName(file.name)}-compressed.pdf`,
          details:
            blob === file
              ? ['This PDF is already as small as this setting can make it.']
              : ['Text remains selectable.'],
        }
      }}
    >
      <h2 className="text-lg font-semibold">Choose compression</h2>
      <p className="text-sm text-muted-foreground">
        Every setting preserves text and page layout. Stronger settings reduce
        the quality of supported embedded photos.
      </p>
      <div className="space-y-2">
        <Label htmlFor="pdf-compression-mode">Quality</Label>
        <select
          id="pdf-compression-mode"
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as PDFCompressionMode)
          }
        >
          <option value="lossless">
            Lossless · keep original image quality
          </option>
          <option value="balanced">Balanced · compress photos</option>
          <option value="small">Smaller file · lower photo quality</option>
        </select>
      </div>
    </PDFAction>
  )
}
