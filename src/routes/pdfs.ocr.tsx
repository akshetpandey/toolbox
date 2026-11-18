import { MessageError } from '@/i18n/MessageError'
import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { pdfBaseName } from '@/lib/pdf-edit'

export const Route = createFileRoute('/pdfs/ocr')({
  component: PDFOCRRoute,
})

function PDFOCRRoute() {
  const t = useTranslator()
  const { file, clearFiles } = usePDFSource()
  return (
    <PDFAction
      file={file}
      sourceKey={file?.name ?? ''}
      name="pdfs.edit.ocr"
      label={t('pdfsOcrMakeSearchableAndDownload')}
      status={message('pdfsOcrOpeningYourPDF')}
      onReset={clearFiles}
      run={async (signal, setStatus) => {
        if (!file) throw new MessageError('pdfsOcrChooseAPDFFirst')
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
              ? message(
                  'pdfsOcrAddedSearchableTextTo',
                  { recognized },
                  recognized,
                )
              : message('pdfsOcrNoNewTextWasRecognizedThis'),
          ],
        }
      }}
    >
      <h2 className="text-lg font-semibold">{t('pdfsOcrFindTextInScans')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('pdfsOcrRecognizesEnglishTextOnScannedPages')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('pdfsOcrCheckTheRecognizedTextAgainstYour')}
      </p>
    </PDFAction>
  )
}
