import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
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
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText,
  Merge,
  Split,
  Minimize,
  Trash2,
  File,
  GripVertical,
  ArrowUpDown,
} from 'lucide-react'
import { type PDFFile, isPDFFile, createPDFFile } from '@/lib/pdf'
import { formatFileSize, truncateFilename } from '@/lib/shared'
import { Button } from '@/components/ui'

const pdfTabs = [
  { value: 'merge', label: 'Merge', icon: Merge },
  { value: 'split', label: 'Split', icon: Split },
  { value: 'compress', label: 'Compress', icon: Minimize },
]

interface SortableFileItemProps {
  file: PDFFile
  onRemove: (id: string) => void
  isDragging?: boolean
}

function SortableFileItem({
  file,
  onRemove,
  isDragging = false,
}: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between p-3 bg-muted/50 rounded-lg transition-all duration-200 ${
        isSortableDragging || isDragging
          ? 'opacity-50 shadow-lg ring-2 ring-primary/50 z-50'
          : 'hover:bg-muted/70'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="h-4 w-4 cursor-move text-muted-foreground hover:text-foreground transition-colors touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-foreground text-sm" title={file.name}>
            {truncateFilename(file.name)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(file.id)
        }}
        className="text-destructive hover:text-destructive h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
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
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/merge')) return 'merge'
    if (path.includes('/split')) return 'split'
    if (path.includes('/compress')) return 'compress'
    return 'merge' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/pdfs/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  const handleFileSelect = useCallback((files: FileList) => {
    console.log('📄 PDFTools: File selection started', {
      fileCount: files.length,
    })

    const pdfFiles: PDFFile[] = []

    for (const file of Array.from(files)) {
      if (isPDFFile(file)) {
        console.log('📄 PDFTools: Processing PDF file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const pdfFile = createPDFFile(file)
        pdfFiles.push(pdfFile)
      } else {
        console.warn('📄 PDFTools: Invalid file type selected', {
          name: file.name,
          type: file.type,
        })
      }
    }

    if (pdfFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...pdfFiles])
      console.log('📄 PDFTools: File selection completed successfully')
    } else {
      alert('Please select valid PDF files')
    }
  }, [])

  const removeFile = useCallback((id: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.id !== id))
  }, [])

  const clearFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  const reorderFiles = useCallback((activeId: string, overId: string) => {
    setSelectedFiles((items) => {
      const oldIndex = items.findIndex((item) => item.id === activeId)
      const newIndex = items.findIndex((item) => item.id === overId)
      return arrayMove(items, oldIndex, newIndex)
    })
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && over?.id) {
      reorderFiles(active.id as string, over.id as string)
    }

    setActiveId(null)
  }

  // Find the active file for drag overlay
  const activeFile = activeId
    ? selectedFiles.find((file) => file.id === activeId)
    : null

  // Create context value
  const contextValue: PDFToolsContextType = {
    selectedFiles,
    isProcessing,
    handleFileSelect,
    removeFile,
    clearFiles,
    reorderFiles,
  }

  const pdfFileUpload = (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <FileUpload
        selectedFiles={selectedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          id: file.id,
        }))}
        onFileSelect={handleFileSelect}
        onClearFiles={clearFiles}
        acceptedTypes=".pdf"
        title="Drop PDF files here"
        description="Supports multiple PDF files"
        supportedFormats={['PDF']}
        selectedFileIcon={File}
      >
        {/* Custom file display for PDFs with drag-and-drop reordering */}
        {selectedFiles.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* Reorder instruction */}
            {selectedFiles.length > 1 && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <ArrowUpDown className="w-3 h-3" />
                  <span>Drag files to reorder them</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <SortableContext
                items={selectedFiles}
                strategy={verticalListSortingStrategy}
              >
                {selectedFiles.map((file) => (
                  <SortableFileItem
                    key={file.id}
                    file={file}
                    onRemove={removeFile}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        )}
      </FileUpload>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeFile ? (
          <div className="group flex items-center justify-between p-3 bg-muted/50 rounded-lg shadow-lg ring-2 ring-primary">
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-primary" />
              <div>
                <p
                  className="font-medium text-foreground text-sm"
                  title={activeFile.name}
                >
                  {truncateFilename(activeFile.name, 25)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )

  const pdfToolsNav = (
    <div className="w-full">
      <ResponsiveTabs
        tabs={pdfTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        isProcessing={isProcessing}
      />
    </div>
  )

  return (
    <PDFToolsContext.Provider value={contextValue}>
      <ToolLayout
        title="PDF Tools"
        icon={FileText}
        iconColor="text-green-500"
        iconBgColor="bg-gradient-to-br from-green-500/10 to-green-500/5"
        fileUploadComponent={pdfFileUpload}
        toolsComponent={pdfToolsNav}
      >
        <Outlet />
      </ToolLayout>
    </PDFToolsContext.Provider>
  )
}
