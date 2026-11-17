import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, RotateCw, Trash2 } from 'lucide-react'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import {
  PDFPageThumbnail,
  usePDFThumbnails,
} from '@/components/PDFPageThumbnail'
import { Button } from '@/components/ui/button'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { organizePDF, pdfBaseName, type PDFPageEdit } from '@/lib/pdf-edit'

export const Route = createFileRoute('/pdfs/organize')({
  component: PDFOrganizeRoute,
})

function PDFOrganizeRoute() {
  const t = useTranslator()
  const { file, count, clearFiles } = usePDFSource()
  const watchThumbnail = usePDFThumbnails(count ? file : undefined)
  const [edits, setEdits] = useWorkspaceState<PDFPageEdit[] | null>(
    'pdfs.edit.organize.pages',
    null,
  )
  const initial = useMemo(
    () =>
      Array.from({ length: count ?? 0 }, (_, index) => ({
        index,
        rotation: 0,
      })),
    [count],
  )
  const pages = edits ?? initial
  return (
    <PDFAction
      file={file}
      sourceKey={JSON.stringify([file?.name, edits])}
      name="pdfs.edit.organize"
      label={t('pdfsOrganizeSaveOrganizedPDF')}
      onReset={clearFiles}
      disabled={!edits || !pages.length}
      run={async () => {
        if (!file) throw new Error(t('pdfsOrganizeChooseAPDFFirst'))
        return {
          blob: await organizePDF(file, pages),
          filename: `${pdfBaseName(file.name)}-organized.pdf`,
          details: [
            message('pdfsOrganizeOfPagesKept', {
              count: pages.length,
              second: count ?? 0,
            }),
          ],
        }
      }}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {t('pdfsOrganizeArrangeYourPages')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('pdfsOrganizeMoveRotateOrRemovePagesPage')}
        </p>
      </div>
      {file && count === null && (
        <p role="alert" className="text-sm text-destructive">
          {t('pdfsOrganizeChooseAReadableUnlockedPDF')}
        </p>
      )}
      {file && count === undefined && (
        <p role="status" className="text-sm">
          {t('pdfsOrganizeReadingPages')}
        </p>
      )}
      {pages.length > 0 && (
        <ol
          aria-label={t('pdfsOrganizeOutputPageOrder')}
          className="max-h-[min(26rem,48dvh)] space-y-2 overflow-y-auto sm:max-h-[min(30rem,55dvh)]"
        >
          {pages.map(({ index, rotation }, position) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-md border p-2"
            >
              <PDFPageThumbnail
                index={index}
                rotation={rotation}
                watch={watchThumbnail}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2">
                <span className="text-sm font-medium">
                  {t('pdfsOrganizePage') + ' '}
                  {index + 1}
                  {rotation ? ` · +${rotation}°` : ''}
                </span>
                <div className="flex max-w-full flex-wrap">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t('pdfsOrganizeMovePageUp', {
                      number: index + 1,
                    })}
                    disabled={position === 0}
                    onClick={() =>
                      setEdits(arrayMove(pages, position, position - 1))
                    }
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t('pdfsOrganizeMovePageDown', {
                      number: index + 1,
                    })}
                    disabled={position === pages.length - 1}
                    onClick={() =>
                      setEdits(arrayMove(pages, position, position + 1))
                    }
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={t('pdfsOrganizeRotatePageClockwise', {
                      number: index + 1,
                    })}
                    onClick={() =>
                      setEdits(
                        pages.map((page) =>
                          page.index === index
                            ? { index, rotation: (rotation + 90) % 360 }
                            : page,
                        ),
                      )
                    }
                  >
                    <RotateCw aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive"
                    aria-label={t('pdfsOrganizeRemovePage', {
                      number: index + 1,
                    })}
                    disabled={pages.length === 1}
                    onClick={() =>
                      setEdits(pages.filter((page) => page.index !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {edits && (
        <Button variant="outline" onClick={() => setEdits(null)}>
          {t('pdfsOrganizeResetPageChanges')}
        </Button>
      )}
    </PDFAction>
  )
}
