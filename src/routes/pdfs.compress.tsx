import { MessageError } from '@/i18n/MessageError'
import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
  const t = useTranslator()
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
      label={t('pdfsCompressCompressAndDownload')}
      onReset={clearFiles}
      run={async (signal) => {
        if (!file) throw new MessageError('pdfsCompressChooseAPDFFirst')
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
              ? [message('pdfsCompressThisPDFIsAlreadyAsSmall')]
              : [message('pdfsCompressTextRemainsSelectable')],
        }
      }}
    >
      <h2 className="text-lg font-semibold">
        {t('pdfsCompressChooseCompression')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t('pdfsCompressEverySettingPreservesTextAndPage')}
      </p>
      <div className="space-y-2">
        <Label htmlFor="pdf-compression-mode">{t('pdfsCompressQuality')}</Label>
        <select
          id="pdf-compression-mode"
          className="min-h-11 w-full rounded-md border bg-background px-3"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as PDFCompressionMode)
          }
        >
          <option value="lossless">
            {t('pdfsCompressLosslessKeepOriginalImageQuality')}
          </option>
          <option value="balanced">
            {t('pdfsCompressBalancedCompressPhotos')}
          </option>
          <option value="small">
            {t('pdfsCompressSmallerFileLowerPhotoQuality')}
          </option>
        </select>
      </div>
    </PDFAction>
  )
}
