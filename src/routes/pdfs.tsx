import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  PDFToolsContext,
  type PDFToolsContextType,
} from '@/contexts/PDFToolsContext'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText,
  File,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
} from 'lucide-react'
import { type PDFFile, isPDFFile, createPDFFile } from '@/lib/pdf'
import { formatFileSize } from '@/lib/shared'
import { Button } from '@/components/ui/button'

interface SortableFileItemProps {
  file: PDFFile
  index: number
  count: number
  pageCount?: number | null
  disabled: boolean
  onRemove: () => void
  onMove: (direction: -1 | 1) => void
}

function SortableFileItem({
  file,
  index,
  count,
  pageCount,
  disabled,
  onRemove,
  onMove,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id, disabled })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`min-w-0 rounded-lg border bg-background p-3 ${isDragging ? 'opacity-50 ring-2 ring-primary/50' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag ${file.name} to reorder`}
          disabled={disabled}
          className="flex size-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">
            <span className="text-muted-foreground">{index + 1}. </span>
            {file.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatFileSize(file.size)} ·{' '}
            {pageCount === undefined
              ? 'Reading pages…'
              : pageCount === null
                ? 'Could not read PDF'
                : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`}
          </p>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Move ${file.name} up`}
          disabled={disabled || index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`Move ${file.name} down`}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-destructive"
          aria-label={`Remove ${file.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </li>
  )
}

export const Route = createFileRoute('/pdfs')({
  component: PDFToolsLayout,
  head: () => ({
    meta: [
      {
        title: 'PDF Tools - Free Browser-Based PDF Processing | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based PDF processing tools. Merge, split, and compress PDF files entirely in your browser. No uploads required, complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free PDF tools, PDF merger, PDF splitter, PDF compressor, browser PDF editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'PDF Tools - Free Browser-Based PDF Processing',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based PDF processing tools. Process PDFs entirely in your browser with complete privacy.',
      },
    ],
  }),
})

function PDFToolsLayout() {
  const { isProcessing } = useProcessing()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useWorkspaceState<PDFFile[]>(
    'pdfs.files',
    [],
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pageCounts, setPageCounts] = useState<Record<string, number | null>>(
    {},
  )
  const [selectionError, setSelectionError] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    let current = true
    const missing = selectedFiles.filter(
      (file) => pageCounts[file.id] === undefined,
    )
    if (missing.length > 0) {
      void (async () => {
        const counts = await Promise.all(
          missing.map(async (file): Promise<[string, number | null]> => {
            try {
              const { PDFDocument } = await import('pdf-lib')
              const pdf = await PDFDocument.load(await file.file.arrayBuffer())
              return [file.id, pdf.getPageCount()]
            } catch (error) {
              console.warn('PDF page count could not be read:', error)
              return [file.id, null]
            }
          }),
        )
        if (current)
          setPageCounts((previous) => ({
            ...previous,
            ...Object.fromEntries(counts),
          }))
      })()
    }
    return () => {
      current = false
    }
  }, [selectedFiles, pageCounts])

  const handleFileSelect = useCallback(
    (files: FileList) => {
      if (isProcessing || files.length === 0) return
      setSelectionError('')
      const pdfFiles = Array.from(files)
        .filter(isPDFFile)
        .map((file) => ({ ...createPDFFile(file), id: crypto.randomUUID() }))
      if (pdfFiles.length) {
        setSelectedFiles((previous) => [...previous, ...pdfFiles])
        invalidateWorkspaceState(['result.pdfs.'])
      }
      if (pdfFiles.length !== files.length)
        setSelectionError(
          'Only PDF files were added. Choose PDF files to continue.',
        )
    },
    [isProcessing, setSelectedFiles],
  )

  const removeFile = useCallback(
    (id: string) => {
      setSelectedFiles((files) => files.filter((file) => file.id !== id))
      invalidateWorkspaceState(['result.pdfs.'])
    },
    [setSelectedFiles],
  )
  const clearFiles = useCallback(() => {
    setSelectedFiles([])
    invalidateWorkspaceState(['result.pdfs.'])
    setPageCounts({})
    setSelectionError('')
  }, [setSelectedFiles])
  const reorderFiles = useCallback(
    (fromId: string, toId: string) => {
      setSelectedFiles((items) => {
        const from = items.findIndex((file) => file.id === fromId)
        const to = items.findIndex((file) => file.id === toId)
        return from < 0 || to < 0 ? items : arrayMove(items, from, to)
      })
      invalidateWorkspaceState(['result.pdfs.'])
    },
    [setSelectedFiles],
  )
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      reorderFiles(String(active.id), String(over.id))
    setActiveId(null)
  }
  const activeFile = selectedFiles.find((file) => file.id === activeId)
  const contextValue: PDFToolsContextType = {
    selectedFiles,
    isProcessing,
    handleFileSelect,
    removeFile,
    clearFiles,
    reorderFiles,
    pageCounts,
  }
  const unavailable = /\/(split|compress)\/?$/.test(location.pathname)
  const pdfFileUpload = (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <FileUpload
        selectedFiles={selectedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          id: file.id,
        }))}
        onFileSelect={handleFileSelect}
        onClearFiles={clearFiles}
        acceptedTypes=".pdf,application/pdf"
        title="Choose PDF files"
        description="Add two or more PDFs, then arrange them in the order you want."
        supportedFormats={['PDF']}
        selectedFileIcon={File}
        multiple
        selectedActionLabel="Add files"
        disabled={isProcessing}
      >
        {selectedFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Drag to reorder, or use the move up and down buttons.
            </p>
            <ol aria-label="PDF merge order" className="space-y-2">
              <SortableContext
                items={selectedFiles}
                strategy={verticalListSortingStrategy}
              >
                {selectedFiles.map((file, index) => (
                  <SortableFileItem
                    key={file.id}
                    file={file}
                    index={index}
                    count={selectedFiles.length}
                    pageCount={pageCounts[file.id]}
                    disabled={isProcessing}
                    onRemove={() => removeFile(file.id)}
                    onMove={(direction) => {
                      const target = selectedFiles[index + direction]
                      if (target) reorderFiles(file.id, target.id)
                    }}
                  />
                ))}
              </SortableContext>
            </ol>
          </div>
        )}
      </FileUpload>
      <DragOverlay>
        {activeFile && (
          <div
            aria-hidden="true"
            className="rounded-lg border bg-card p-3 text-sm font-medium shadow-md [overflow-wrap:anywhere]"
          >
            {activeFile.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
  return (
    <PDFToolsContext.Provider value={contextValue}>
      <ToolLayout
        title={unavailable ? 'PDF tools' : 'Merge PDFs'}
        icon={FileText}
        iconColor="text-primary"
        iconBgColor="bg-primary/10"
        fileUploadComponent={unavailable ? null : pdfFileUpload}
        toolsComponent={null}
      >
        {selectionError && (
          <p role="alert" className="text-sm text-destructive">
            {selectionError}
          </p>
        )}
        <Outlet />
      </ToolLayout>
    </PDFToolsContext.Provider>
  )
}
