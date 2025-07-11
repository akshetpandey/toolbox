import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Upload,
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
        className="text-destructive hover:text-destructive h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export const Route = createFileRoute('/pdfs')({
  component: PDFToolsLayout,
})

function PDFToolsLayout() {
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
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

  return (
    <PDFToolsContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="glass border-b border-border/50">
            <div className="container mx-auto p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg flex items-center justify-center">
                    <FileText className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <h1 className="text-heading text-foreground">PDF Tools</h1>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto p-6">
              <div className="flex gap-6 h-full">
                {/* Left 1/3 - File Upload Area */}
                <div className="w-1/3">
                  <Card className="glass-card border-0 animate-fade-in h-full">
                    <CardContent className="p-6 h-full">
                      {selectedFiles.length === 0 ? (
                        // Upload interface when no files are selected
                        <div
                          className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center"
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Drop PDF files here
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Supports multiple PDF files
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              PDF
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        // Display uploaded files
                        <div
                          className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col"
                          onDrop={handleDrop}
                          onDragOver={handleDragOver}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                                <File className="h-3 w-3 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                Selected Files ({selectedFiles.length})
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                clearFiles()
                              }}
                              className="hover:bg-red-500 hover:text-red-foreground text-xs"
                            >
                              Clear All
                            </Button>
                          </div>

                          {/* Reorder instruction */}
                          {selectedFiles.length > 1 && (
                            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                                <ArrowUpDown className="w-3 h-3" />
                                <span>Drag files to reorder them</span>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col gap-2 flex-1 overflow-auto">
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

                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <Upload className="w-3 h-3" />
                              <span>Click to add more files</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            handleFileSelect(e.target.files)
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right 2/3 - Tools */}
                <div className="w-2/3">
                  <div className="animate-fade-in">
                    <div className="flex flex-col gap-4">
                      {/* Navigation */}
                      <Tabs
                        value={currentTab}
                        onValueChange={handleTabChange}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger
                            value="merge"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Merge className="w-4 h-4" />
                            Merge
                          </TabsTrigger>
                          <TabsTrigger
                            value="split"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Split className="w-4 h-4" />
                            Split
                          </TabsTrigger>
                          <TabsTrigger
                            value="compress"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minimize className="w-4 h-4" />
                            Compress
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      {/* Tool Content */}
                      <Outlet />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
    </PDFToolsContext.Provider>
  )
}
