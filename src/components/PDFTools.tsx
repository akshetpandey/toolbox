import { useState, useCallback, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Footer } from '@/components/Footer'
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
  Info,
  Merge,
  Loader2,
  Download,
  Trash2,
  File,
  Split,
  Minimize,
  GripVertical,
  ArrowUpDown,
} from 'lucide-react'
import { type PDFFile, mergePDFs, isPDFFile, createPDFFile } from '@/lib/pdf'
import { formatFileSize, truncateFilename, downloadBlob } from '@/lib/shared'

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

export function PDFTools() {
  const search = useSearch({ from: '/pdfs' })
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState<PDFFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  // Get the current active tab from URL search params
  const activeTab = search?.tab ?? 'merge'

  // Handle tab changes
  const handleTabChange = async (value: string) => {
    await navigate({
      to: '/pdfs',
      search: { tab: value },
    })
  }

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

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const clearFiles = () => {
    setSelectedFiles([])
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setSelectedFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)

        return arrayMove(items, oldIndex, newIndex)
      })
    }

    setActiveId(null)
  }

  const handleMergePDFs = async () => {
    if (selectedFiles.length < 2) {
      alert('Please select at least 2 PDF files to merge')
      return
    }

    console.log('📄 PDFTools: Starting PDF merge operation', {
      fileCount: selectedFiles.length,
      fileNames: selectedFiles.map((f) => f.name),
    })

    setIsProcessing(true)

    try {
      const result = await mergePDFs({
        files: selectedFiles,
        onFileProcessed: (fileIndex, fileName, pageCount) => {
          console.log(
            `📄 PDFTools: Processed ${fileName} - ${pageCount} pages added (${fileIndex + 1}/${selectedFiles.length})`,
          )
        },
      })

      if (result.success && result.blob) {
        downloadBlob(result.blob, 'merged-document.pdf')
        console.log('📄 PDFTools: PDF merge completed successfully')
        setIsProcessing(false)
      } else {
        throw new Error(result.error ?? 'Unknown error occurred')
      }
    } catch (error) {
      console.error('📄 PDFTools: Error merging PDFs:', error)
      alert(
        `Error merging PDFs: ${error instanceof Error ? error.message : 'Please try again.'}`,
      )
      setIsProcessing(false)
    }
  }

  // Find the active file for drag overlay
  const activeFile = activeId
    ? selectedFiles.find((file) => file.id === activeId)
    : null

  return (
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
                          void handleFileSelect(e.target.files)
                        }
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right 2/3 - Tools */}
              <div className="w-2/3">
                <div className="animate-fade-in">
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => void handleTabChange(value)}
                    className="flex flex-col gap-4"
                  >
                    <TabsList className="flat-card border-0 grid w-full grid-cols-3 h-10">
                      <TabsTrigger
                        value="merge"
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                      >
                        <Merge className="w-4 h-4 mr-2" />
                        Merge
                      </TabsTrigger>
                      <TabsTrigger
                        value="split"
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                      >
                        <Split className="w-4 h-4 mr-2" />
                        Split
                      </TabsTrigger>
                      <TabsTrigger
                        value="compress"
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                      >
                        <Minimize className="w-4 h-4 mr-2" />
                        Compress
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="merge">
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          {selectedFiles.length >= 2 ? (
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center gap-3">
                                <Merge className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <h3 className="font-semibold text-foreground">
                                    Merge PDFs
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    Combine {selectedFiles.length} PDF files
                                    into one document in the order shown
                                  </p>
                                </div>
                              </div>

                              {/* Order preview */}
                              <div className="bg-muted/30 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium text-foreground">
                                    Merge Order
                                  </span>
                                </div>
                                <div className="flex flex-col gap-2">
                                  {selectedFiles.map((file, index) => (
                                    <div
                                      key={`preview-${index}`}
                                      className="flex items-center gap-2 text-sm"
                                    >
                                      <span className="text-muted-foreground bg-muted rounded px-2 py-1 min-w-[1.5rem] text-center text-xs">
                                        {index + 1}
                                      </span>
                                      <span className="text-foreground truncate">
                                        {file.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-3">
                                  You can drag and drop files in the left panel
                                  to reorder them
                                </p>
                              </div>

                              <Button
                                onClick={() => void handleMergePDFs()}
                                disabled={isProcessing}
                                className="w-full"
                                size="lg"
                              >
                                {isProcessing ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Merging...
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-2" />
                                    Merge & Download
                                  </>
                                )}
                              </Button>

                              {/* Info about merge */}
                              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                                <div className="flex items-start gap-3">
                                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                                  <div className="flex flex-col gap-2">
                                    <h4 className="font-semibold text-foreground">
                                      About PDF Merge
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                      This tool combines multiple PDF files into
                                      a single document. All embedded fonts and
                                      formatting will be preserved in the merged
                                      PDF. Files are merged in the exact order
                                      they appear in the list above - you can
                                      drag and drop files to reorder them as
                                      needed.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-32">
                              <div className="text-center text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">
                                  Select at least 2 PDF files to merge
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="split">
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          <div className="text-center py-12">
                            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              Split PDF Tool
                            </h3>
                            <p className="text-muted-foreground">
                              Coming soon! This tool will allow you to split PDF
                              files into separate PDFs.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="compress">
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          <div className="text-center py-12">
                            <Minimize className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                              Compress PDF Tool
                            </h3>
                            <p className="text-muted-foreground">
                              Coming soon! This tool will allow you to compress
                              PDF files to reduce their size.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
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
  )
}
