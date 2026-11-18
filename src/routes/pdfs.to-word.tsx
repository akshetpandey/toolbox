import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { convertPDFToWord } from '@/lib/pdf-to-word'

export const Route = createFileRoute('/pdfs/to-word')({
  component: PDFToWord,
})

function PDFToWord() {
  const t = useTranslator()
  const { file, clearFiles } = usePDFSource()
  return (
    <PDFAction
      file={file}
      sourceKey={file?.name ?? ''}
      name="pdfs.edit.to-word"
      label={t('pdfsToWordExportToWord')}
      onReset={clearFiles}
      run={(signal, onProgress) => convertPDFToWord(file!, signal, onProgress)}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          {t('pdfsToWordExportEditableText')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('pdfsToWordTheWordDocumentContainsSelectableText')}
        </p>
      </div>
    </PDFAction>
  )
}
