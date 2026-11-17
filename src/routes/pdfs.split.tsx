import { MessageError } from '@/i18n/MessageError'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { PDFAction, PDFPageRanges, usePDFSource } from '@/components/PDFAction'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { extractPDFPages, pdfBaseName } from '@/lib/pdf-edit'
import { Label } from '@/components/ui'

export const Route = createFileRoute('/pdfs/split')({
  component: PDFSplitRoute,
})

function PDFSplitRoute() {
  const t = useTranslator()
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
      label={
        separate
          ? t('pdfsSplitSplitAndDownloadZIP')
          : t('pdfsSplitExtractAndDownloadPDF')
      }
      onReset={clearFiles}
      run={async (signal) => {
        if (!file) throw new MessageError('pdfsSplitChooseAPDFFirst')
        const result = await extractPDFPages(file, ranges, separate, signal)
        return {
          blob: result.blob,
          filename: `${pdfBaseName(file.name)}-${separate ? 'parts' : 'pages'}.${result.extension}`,
          details: [
            `${result.count} ${separate ? t('pdfsSplitPDFsInTheZIP') : t('pdfsSplitPagesSelected')}`,
          ],
        }
      }}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t('pdfsSplitChooseWhichPagesToKeep')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {typeof count === 'number'
            ? t('pdfsSplitYourDocumentHas', { count }, count)
            : t('pdfsSplitChooseOnePDFToGetStarted')}
        </p>
      </div>
      <PDFPageRanges
        value={ranges}
        setValue={setRanges}
        hint={
          separate
            ? t('pdfsSplitForExample135CreatesTwo')
            : t('pdfsSplitForExample135SavesPages')
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
        {t('pdfsSplitSaveEachRangeAsASeparate')}
      </Label>
    </PDFAction>
  )
}
