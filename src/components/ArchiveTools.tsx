import { useState, useCallback, useRef, useMemo } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArchiveProcessor,
  type ArchiveFile,
  type ExtractedFile,
  type CompressionFormat,
  formatFileSize,
  downloadFile,
} from '@/lib/archive'
import {
  Upload,
  Archive,
  FileArchive,
  Download,
  Loader2,
  File as FileIcon,
  Folder,
  X,
  Plus,
  Package,
} from 'lucide-react'
import { Footer } from '@/components/Footer'

export function ArchiveTools() {
  const search = useSearch({ from: '/archives' })
  const navigate = useNavigate()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<ArchiveFile[]>([])
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [compressionFormat, setCompressionFormat] =
    useState<CompressionFormat>('zip')
  const [archiveName, setArchiveName] = useState('archive')
  const [uploadedArchive, setUploadedArchive] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const archiveInputRef = useRef<HTMLInputElement>(null)

  // Create archive processor instance
  const archiveProcessor = useMemo(() => new ArchiveProcessor(), [])

  // Get the current active tab from URL search params
  const activeTab = search?.tab ?? 'compress'

  // Handle tab changes
  const handleTabChange = (value: string) => {
    return navigate({
      to: '/archives',
      search: { tab: value },
    })
  }

  // Initialize the archive processor
  const initializeProcessor = useCallback(async () => {
    if (!isInitialized && !isInitializing) {
      setIsInitializing(true)
      try {
        await archiveProcessor.init()
        setIsInitialized(true)
        console.log(
          '🗜️ ArchiveTools: Archive processor initialized successfully',
        )
      } catch (error) {
        console.error(
          '🗜️ ArchiveTools: Failed to initialize archive processor:',
          error,
        )
      } finally {
        setIsInitializing(false)
      }
    }
  }, [isInitialized, isInitializing, archiveProcessor])

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

      // Append new files to existing selected files instead of replacing
      setSelectedFiles((prevFiles) => [...prevFiles, ...archiveFiles])

      // Initialize processor if not already initialized
      if (!isInitialized) {
        await initializeProcessor()
      }
    },
    [isInitialized, initializeProcessor],
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
    [isInitialized, initializeProcessor],
  )

  // Handle drag and drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        if (activeTab === 'compress') {
          await handleFileSelect(e.dataTransfer.files)
        } else {
          await handleArchiveUpload(e.dataTransfer.files)
        }
      }
    },
    [activeTab, handleFileSelect, handleArchiveUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Remove file from compression list
  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Compress files
  const compressFiles = useCallback(async () => {
    if (selectedFiles.length === 0 || !isInitialized) return

    setIsProcessing(true)

    try {
      console.log('🗜️ ArchiveTools: Starting compression', {
        fileCount: selectedFiles.length,
        format: compressionFormat,
        archiveName,
      })

      const compressedData = await archiveProcessor.compress(
        selectedFiles,
        compressionFormat,
        archiveName,
      )

      const extension =
        compressionFormat === 'gzip' ? 'tar.gz' : compressionFormat
      const filename = `${archiveName}.${extension}`

      downloadFile(compressedData, filename, 'application/octet-stream')

      console.log('🗜️ ArchiveTools: Compression completed successfully')
    } catch (error) {
      console.error('🗜️ ArchiveTools: Compression failed:', error)
      alert('Compression failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [
    selectedFiles,
    isInitialized,
    compressionFormat,
    archiveName,
    archiveProcessor,
  ])

  // Decompress archive
  const decompressArchive = useCallback(async () => {
    if (!uploadedArchive || !isInitialized) return

    setIsProcessing(true)

    try {
      console.log('🗜️ ArchiveTools: Starting decompression', {
        archiveName: uploadedArchive.name,
        size: uploadedArchive.size,
      })

      const archiveData = new Uint8Array(await uploadedArchive.arrayBuffer())
      const extractedFiles = archiveProcessor.decompress(
        archiveData,
        uploadedArchive.name,
      )

      setExtractedFiles(extractedFiles)

      console.log('🗜️ ArchiveTools: Decompression completed successfully', {
        extractedCount: extractedFiles.length,
      })
    } catch (error) {
      console.error('🗜️ ArchiveTools: Decompression failed:', error)
      alert('Decompression failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [uploadedArchive, isInitialized, archiveProcessor])

  // Download individual file
  const downloadExtractedFile = useCallback((file: ExtractedFile) => {
    if (file.isDirectory) return

    const mimeType = file.name.endsWith('.txt')
      ? 'text/plain'
      : 'application/octet-stream'
    downloadFile(file.data, file.name, mimeType)
  }, [])

  // Download all extracted files as ZIP
  const downloadAllFiles = useCallback(async () => {
    if (extractedFiles.length === 0 || !isInitialized) return

    setIsProcessing(true)

    try {
      const nonDirectoryFiles = extractedFiles.filter((f) => !f.isDirectory)
      const archiveFiles: ArchiveFile[] = nonDirectoryFiles.map((f) => ({
        file: new File([f.data], f.name, { type: 'application/octet-stream' }),
        name: f.name,
        size: f.size,
        type: 'application/octet-stream',
      }))

      const compressedData = await archiveProcessor.compress(
        archiveFiles,
        'zip',
        'extracted_files',
      )

      downloadFile(compressedData, 'extracted_files.zip', 'application/zip')

      console.log('🗜️ ArchiveTools: All files downloaded successfully')
    } catch (error) {
      console.error('🗜️ ArchiveTools: Failed to download all files:', error)
      alert('Failed to download all files. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [extractedFiles, isInitialized, archiveProcessor])

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
                  {activeTab === 'compress' ? (
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
                                  setSelectedFiles([])
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
                    // Decompress file upload
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
                  value={activeTab}
                  onValueChange={(value: string) => void handleTabChange(value)}
                  className="flex flex-col gap-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-2 h-10">
                    <TabsTrigger
                      value="compress"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Package className="w-4 h-4 mr-2" />
                      Compress
                    </TabsTrigger>
                    <TabsTrigger
                      value="decompress"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <FileArchive className="w-4 h-4 mr-2" />
                      Decompress
                    </TabsTrigger>
                  </TabsList>

                  {/* Compress Tab */}
                  <TabsContent value="compress" className="flex flex-col gap-4">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Label htmlFor="archive-name">Archive Name</Label>
                              <Input
                                id="archive-name"
                                value={archiveName}
                                onChange={(e) => setArchiveName(e.target.value)}
                                placeholder="Enter archive name"
                                className="mt-1"
                              />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor="compression-format">
                                Compression Format
                              </Label>
                              <Select
                                value={compressionFormat}
                                onValueChange={(value) =>
                                  setCompressionFormat(
                                    value as CompressionFormat,
                                  )
                                }
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="7z">7Z</SelectItem>
                                  <SelectItem value="zip">ZIP</SelectItem>
                                  <SelectItem value="tar">TAR</SelectItem>
                                  <SelectItem value="gzip">GZIP</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Compress Button */}
                          <div className="flex justify-center">
                            <Button
                              onClick={() => {
                                void compressFiles()
                              }}
                              disabled={
                                selectedFiles.length === 0 ||
                                isProcessing ||
                                !isInitialized
                              }
                              className="gap-2"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Package className="h-4 w-4" />
                              )}
                              {isProcessing
                                ? 'Compressing...'
                                : 'Compress Files'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Decompress Tab */}
                  <TabsContent
                    value="decompress"
                    className="flex flex-col gap-4"
                  >
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          {/* Extract Button */}
                          <div className="flex justify-center">
                            <Button
                              onClick={() => {
                                void decompressArchive()
                              }}
                              disabled={
                                !uploadedArchive ||
                                isProcessing ||
                                !isInitialized
                              }
                              className="gap-2"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileArchive className="h-4 w-4" />
                              )}
                              {isProcessing ? 'Extracting...' : 'Extract Files'}
                            </Button>
                          </div>

                          {/* Download All Button */}
                          {extractedFiles.length > 0 && (
                            <div className="flex justify-center">
                              <Button
                                onClick={() => {
                                  void downloadAllFiles()
                                }}
                                disabled={isProcessing}
                                variant="outline"
                                className="gap-2"
                              >
                                <Download className="h-4 w-4" />
                                Download All as ZIP
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Extracted Files Display */}
                    {extractedFiles.length > 0 && (
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-foreground">
                                Extracted Files (
                                {
                                  extractedFiles.filter((f) => !f.isDirectory)
                                    .length
                                }{' '}
                                files,{' '}
                                {
                                  extractedFiles.filter((f) => f.isDirectory)
                                    .length
                                }{' '}
                                folders)
                              </h3>
                              <div className="text-sm text-muted-foreground">
                                Total size:{' '}
                                {formatFileSize(
                                  extractedFiles.reduce(
                                    (sum, f) => sum + f.size,
                                    0,
                                  ),
                                )}
                              </div>
                            </div>

                            <div className="max-h-96 overflow-auto border rounded-lg">
                              <div className="flex flex-col gap-1 p-2">
                                {extractedFiles.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                                  >
                                    {file.isDirectory ? (
                                      <Folder className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                    ) : (
                                      <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {file.name}
                                      </p>
                                      {!file.isDirectory && (
                                        <p className="text-xs text-muted-foreground">
                                          {formatFileSize(file.size)}
                                        </p>
                                      )}
                                    </div>
                                    {!file.isDirectory && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          downloadExtractedFile(file)
                                        }
                                        className="gap-2 flex-shrink-0"
                                      >
                                        <Download className="h-4 w-4" />
                                        Download
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
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
  )
}
