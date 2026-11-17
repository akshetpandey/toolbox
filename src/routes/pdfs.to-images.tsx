import { MessageError } from '@/i18n/MessageError'
import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
  const t = useTranslator()
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
      label={t('pdfsToImagesExportPages')}
      onReset={clearFiles}
      disabled={!count}
      run={async (signal, setStatus) => {
        if (!file || !count)
          throw new MessageError('pdfsToImagesChooseAReadablePDFFirst')
        const pages = parsePageRanges(ranges, count).flat()
        const blob = await exportPDFImages(
          file,
          pages,
          format,
          scale,
          signal,
          (index) => {
            setStatus(
              message('pdfsToImagesRenderedOfPages', {
                index,
                count: pages.length,
              }),
            )
          },
        )
        return {
          blob,
          filename: `${pdfBaseName(file.name)}-${pages.length === 1 ? `page-${pages[0] + 1}.${format}` : 'images.zip'}`,
          details: [
            message(
              'pdfsToImagesExported',
              { count: pages.length },
              pages.length,
            ),
          ],
        }
      }}
    >
      <h2 className="text-lg font-semibold">
        {t('pdfsToImagesSavePDFPagesAsImages')}
      </h2>
      <PDFPageRanges
        value={ranges}
        setValue={setRanges}
        hint={t('pdfsToImagesPageRangeHint')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pdf-image-format">
            {t('pdfsToImagesImageFormat')}
          </Label>
          <select
            id="pdf-image-format"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={format}
            onChange={(event) => setFormat(event.target.value as 'jpg' | 'png')}
          >
            <option value="jpg">{t('pdfsToImagesJPGSmallerFiles')}</option>
            <option value="png">{t('pdfsToImagesPNGLosslessQuality')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pdf-image-resolution">
            {t('pdfsToImagesResolution')}
          </Label>
          <select
            id="pdf-image-resolution"
            className="min-h-11 w-full rounded-md border bg-background px-3"
            value={scale}
            onChange={(event) => setScale(Number(event.target.value))}
          >
            <option value={1}>{t('pdfsToImagesStandard')}</option>
            <option value={2}>{t('pdfsToImagesHigh')}</option>
            <option value={3}>{t('pdfsToImagesVeryHigh')}</option>
          </select>
        </div>
      </div>
      {count === null && (
        <p role="alert" className="text-sm text-destructive">
          {t('pdfsToImagesChooseAReadableUnlockedPDF')}
        </p>
      )}
    </PDFAction>
  )
}
