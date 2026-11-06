import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { ArrowDown, ArrowUp, RotateCw, Trash2 } from 'lucide-react'
import { PDFAction, usePDFSource } from '@/components/PDFAction'
import { Button } from '@/components/ui/button'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { organizePDF, pdfBaseName, type PDFPageEdit } from '@/lib/pdf-edit'

export const Route = createFileRoute('/pdfs/organize')({
  component: PDFOrganizeRoute,
})

function PDFOrganizeRoute() {
  const { file, count, clearFiles } = usePDFSource()
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
      label="Save organized PDF"
      onReset={clearFiles}
      disabled={!edits || !pages.length}
      run={async () => {
        if (!file) throw new Error('Choose a PDF first.')
        return {
          blob: await organizePDF(file, pages),
          filename: `${pdfBaseName(file.name)}-organized.pdf`,
          details: [`${pages.length} of ${count ?? 0} pages kept`],
        }
      }}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Arrange your pages</h2>
        <p className="text-sm text-muted-foreground">
          Move, rotate, or remove pages. Page labels refer to the original PDF.
        </p>
      </div>
      {file && count === null && (
        <p role="alert" className="text-sm text-destructive">
          Choose a readable, unlocked PDF.
        </p>
      )}
      {file && count === undefined && (
        <p role="status" className="text-sm">
          Reading pages…
        </p>
      )}
      {pages.length > 0 && (
        <ol
          aria-label="Output page order"
          className="max-h-96 space-y-2 overflow-y-auto"
        >
          {pages.map(({ index, rotation }, position) => (
            <li
              key={index}
              className="flex flex-wrap items-center justify-between gap-x-2 rounded-md border p-2"
            >
              <span className="text-sm">
                Page {index + 1}
                {rotation ? ` · +${rotation}°` : ''}
              </span>
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Move page ${index + 1} up`}
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
                  aria-label={`Move page ${index + 1} down`}
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
                  aria-label={`Rotate page ${index + 1} clockwise`}
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
                  aria-label={`Remove page ${index + 1}`}
                  disabled={pages.length === 1}
                  onClick={() =>
                    setEdits(pages.filter((page) => page.index !== index))
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {edits && (
        <Button variant="outline" onClick={() => setEdits(null)}>
          Reset page changes
        </Button>
      )}
    </PDFAction>
  )
}
