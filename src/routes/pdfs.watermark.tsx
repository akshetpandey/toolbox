import { MessageError } from '@/i18n/MessageError'
import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
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
  const t = useTranslator()
  const { file, clearFiles } = usePDFSource()
  const [text, setText] = useWorkspaceState('pdfs.edit.watermark.text', '')
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, text])}
      name="pdfs.edit.watermark"
      label={t('pdfsWatermarkAddWatermarkAndDownload')}
      onReset={clearFiles}
      disabled={!text.trim()}
      run={async () => {
        if (!file) throw new MessageError('pdfsWatermarkChooseAPDFFirst')
        return {
          blob: await stampPDF(file, { type: 'watermark', text }),
          filename: `${pdfBaseName(file.name)}-watermarked.pdf`,
          details: [message('pdfsWatermarkWatermarkAppliedToAllPages')],
        }
      }}
    >
      <h2 className="text-lg font-semibold">
        {t('pdfsWatermarkMarkEveryPage')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t('pdfsWatermarkYourTextAppearsDiagonallyAcrossEvery')}
      </p>
      <div className="space-y-2">
        <Label htmlFor="pdf-watermark-text">
          {t('pdfsWatermarkWatermarkText')}
        </Label>
        <Input
          id="pdf-watermark-text"
          placeholder={t('pdfsWatermarkDraft')}
          value={text}
          maxLength={80}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
    </PDFAction>
  )
}
