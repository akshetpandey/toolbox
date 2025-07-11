import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useCallback, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  ArchiveToolsProvider,
  useArchiveTools,
} from '@/contexts/ArchiveToolsContext'

import { type ArchiveFile, formatFileSize } from '@/lib/archive'
import {
  Upload,
  Archive,
  FileArchive,
  Package,
  File as FileIcon,
  X,
  Plus,
} from 'lucide-react'

export const Route = createFileRoute('/archives')({
  component: ArchiveToolsLayout,
})

function ArchiveToolsLayout() {
  return (
    <ArchiveToolsProvider>
      <ArchiveToolsContent />
    </ArchiveToolsProvider>
  )
}

function ArchiveToolsContent() {
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    isInitialized,
    initializeProcessor,
    selectedFiles,
    addFiles,
    removeFile,
    clearFiles,
    uploadedArchive,
    setUploadedArchive,
    setExtractedFiles,
  } = useArchiveTools()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const archiveInputRef = useRef<HTMLInputElement>(null)

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/compress')) return 'compress'
    if (path.includes('/extract')) return 'extract'
    return 'compress' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/archives/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  // Handle file selection for compression
  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🗜️ ArchiveTools: Files selected for compression', {
        fileCount: files.length,
      })

      const archiveFiles: ArchiveFile[] = []

      for (const file of files) {
        let preview: string | undefined

        if (file.type.startsWith('image/')) {
          preview = URL.createObjectURL(file)
        }

        archiveFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          preview,
        })
      }

      // Add new files to existing selected files
      addFiles(archiveFiles)

      // Initialize processor if not already initialized
      if (!isInitialized) {
        await initializeProcessor()
      }
    },
    [addFiles, isInitialized, initializeProcessor],
  )

  // Handle archive upload for decompression
  const handleArchiveUpload = useCallback(
    async (files: FileList) => {
      const file = files[0]
      if (!file) return

      console.log('🗜️ ArchiveTools: Archive uploaded for decompression', {
        name: file.name,
        size: file.size,
      })

      setUploadedArchive(file)
      setExtractedFiles([])

      // Initialize processor if not already initialized
      if (!isInitialized) {
        await initializeProcessor()
      }
    },
    [setUploadedArchive, setExtractedFiles, isInitialized, initializeProcessor],
  )

  // Handle drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        if (currentTab === 'compress') {
          await handleFileSelect(e.dataTransfer.files)
        } else {
          await handleArchiveUpload(e.dataTransfer.files)
        }
      }
    },
    [currentTab, handleFileSelect, handleArchiveUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg flex items-center justify-center">
                <Archive className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <h1 className="text-heading text-foreground">Archive Tools</h1>
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
                  {currentTab === 'compress' ? (
                    // Compress file upload
                    <div className="h-full flex flex-col">
                      {selectedFiles.length === 0 ? (
                        <div
                          className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group flex-1 flex flex-col justify-center"
                          onDrop={(e) => void handleDrop(e)}
                          onDragOver={handleDragOver}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Drop files to compress
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Select multiple files to create an archive
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Choose Files
                          </Button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col">
                          <div
                            className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group mb-4"
                            onDrop={(e) => void handleDrop(e)}
                            onDragOver={handleDragOver}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                                  <FileIcon className="h-3 w-3 text-primary" />
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
                                Clear
                              </Button>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <Upload className="w-3 h-3" />
                                <span>Click to add more files</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 overflow-auto">
                            <div className="flex flex-col gap-2">
                              {selectedFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                                >
                                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                      {file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatFileSize(file.size)}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFile(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Extract file upload
                    <div className="h-full flex flex-col">
                      {!uploadedArchive ? (
                        <div
                          className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group flex-1 flex flex-col justify-center"
                          onDrop={(e) => void handleDrop(e)}
                          onDragOver={handleDragOver}
                          onClick={() => archiveInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <FileArchive className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Drop archive to extract
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Supports 7Z, ZIP, TAR, GZIP formats
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-2"
                          >
                            <Upload className="h-4 w-4" />
                            Choose Archive
                          </Button>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col">
                          <div
                            className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group mb-4"
                            onDrop={(e) => void handleDrop(e)}
                            onDragOver={handleDragOver}
                            onClick={() => archiveInputRef.current?.click()}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                                  <FileArchive className="h-3 w-3 text-primary" />
                                </div>
                                <span className="text-sm font-medium text-foreground">
                                  Selected Archive
                                </span>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setUploadedArchive(null)
                                  setExtractedFiles([])
                                }}
                                className="hover:bg-red-500 hover:text-red-foreground text-xs"
                              >
                                Clear
                              </Button>
                            </div>

                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                                <FileArchive className="h-8 w-8 text-primary" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {uploadedArchive.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatFileSize(uploadedArchive.size)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <Upload className="w-3 h-3" />
                                <span>Click to change archive</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hidden file inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        void handleFileSelect(e.target.files)
                      }
                    }}
                  />

                  <input
                    ref={archiveInputRef}
                    type="file"
                    accept=".7z,.zip,.tar,.gz,.tar.gz,.rar"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && void handleArchiveUpload(e.target.files)
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right 2/3 - Tools */}
            <div className="w-2/3">
              <div className="animate-fade-in">
                <Tabs
                  value={currentTab}
                  onValueChange={(value: string) => void handleTabChange(value)}
                  className="flex flex-col gap-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-2 h-10">
                    <TabsTrigger
                      value="compress"
                      disabled={isProcessing}
                      className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Compress
                    </TabsTrigger>
                    <TabsTrigger
                      value="extract"
                      disabled={isProcessing}
                      className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <FileArchive className="w-4 h-4 mr-2" />
                      Extract
                    </TabsTrigger>
                  </TabsList>

                  {/* Outlet for individual tool components */}
                  <Outlet />
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
