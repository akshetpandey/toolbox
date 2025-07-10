import { useState, useCallback, useRef } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  extractExifMetadata,
  extractFileMetadata,
  calculateFileHashes,
  formatFileSize,
  type ExifMetadata,
  type FileMetadata,
  type FileHashes,
} from '@/lib/metadata'

import {
  Upload,
  Hash,
  Info,
  FileText,
  Loader2,
  Settings,
  Shield,
  Check,
  X,
} from 'lucide-react'

import { Footer } from '@/components/Footer'
import { useProcessing } from '@/contexts/ProcessingContext'

// Type for uploaded file
interface UploadedFile {
  file: File
  name: string
  size: number
  type: string
}

export function UtilitiesTools() {
  const search = useSearch({ from: '/utilities' })
  const navigate = useNavigate()
  const { isProcessing, setIsProcessing } = useProcessing()
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [exifMetadata, setExifMetadata] = useState<ExifMetadata>({})
  const [fileHashes, setFileHashes] = useState<FileHashes | null>(null)
  const [expectedHash, setExpectedHash] = useState('')
  const [isExtractingExif, setIsExtractingExif] = useState(false)
  const [hashProgress, setHashProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get the current active tab from URL search params
  const activeTab = search?.tab ?? 'hash'

  // Handle tab changes
  const handleTabChange = async (value: string) => {
    // Prevent tab changes while processing
    if (isProcessing) {
      return
    }

    await navigate({
      to: '/utilities',
      search: { tab: value },
    })

    // Auto-generate hashes when switching to hash tab if file is selected
    if (value === 'hash' && selectedFile && !fileHashes && !isProcessing) {
      await generateHashes()
    }

    // Auto-extract metadata when switching to metadata tab if file is selected
    if (
      value === 'metadata' &&
      selectedFile &&
      !fileMetadata &&
      !isProcessing
    ) {
      await extractMetadata()
    }
  }

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🔧 UtilitiesTools: File selection started', {
        fileCount: files.length,
      })

      // Only take the first file
      const file = files[0]
      if (file) {
        console.log('🔧 UtilitiesTools: Processing file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const uploadedFile: UploadedFile = {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        }

        setSelectedFile(uploadedFile)
        setFileMetadata(null)
        setExifMetadata({})
        setFileHashes(null)
        setExpectedHash('')
        setIsProcessing(false)
        setIsExtractingExif(false)
        setHashProgress(0)

        console.log('🔧 UtilitiesTools: File selection completed successfully')

        // Auto-generate hashes when file is selected
        if (activeTab === 'hash') {
          await generateHashes(uploadedFile)
        }

        // Auto-extract metadata when file is selected
        if (activeTab === 'metadata') {
          await extractMetadata(uploadedFile)
        }
      }
    },
    [activeTab],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer.files) {
        await handleFileSelect(e.dataTransfer.files)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const generateHashes = async (file?: UploadedFile) => {
    const targetFile = file ?? selectedFile
    if (!targetFile) return

    setIsProcessing(true)
    setHashProgress(0)

    try {
      const hashes = await calculateFileHashes(targetFile.file, (progress) => {
        setHashProgress(progress)
      })
      setFileHashes(hashes)
    } catch (error) {
      console.error('🔧 UtilitiesTools: Error generating hashes:', error)
    } finally {
      setIsProcessing(false)
      setHashProgress(0)
    }
  }

  const extractMetadata = async (file?: UploadedFile) => {
    const targetFile = file ?? selectedFile
    if (!targetFile) return

    setIsProcessing(true)

    try {
      // Extract file metadata using wasmagic
      const metadata = await extractFileMetadata(targetFile.file)
      setFileMetadata(metadata)

      // Extract EXIF metadata if it's an image
      if (targetFile.type.startsWith('image/')) {
        const exifData = await extractExifMetadata(
          targetFile.file,
          setIsExtractingExif,
        )
        setExifMetadata(exifData)
      }
    } catch (error) {
      console.error('🔧 UtilitiesTools: Error extracting metadata:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setFileMetadata(null)
    setExifMetadata({})
    setFileHashes(null)
    setExpectedHash('')
    setIsProcessing(false)
    setIsExtractingExif(false)
    setHashProgress(0)
  }

  // Check if expected hash matches any of the generated hashes
  const getHashMatch = () => {
    if (!expectedHash || !fileHashes) return null
    const normalizedExpected = expectedHash.toLowerCase().trim()

    if (normalizedExpected === fileHashes.md5.toLowerCase())
      return { type: 'MD5', matches: true }
    if (normalizedExpected === fileHashes.sha1.toLowerCase())
      return { type: 'SHA1', matches: true }
    if (normalizedExpected === fileHashes.sha256.toLowerCase())
      return { type: 'SHA256', matches: true }

    return { type: 'None', matches: false }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-lg flex items-center justify-center">
                <Settings className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h1 className="text-heading text-foreground">Utilities</h1>
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
                  {!selectedFile ? (
                    // Upload interface when no files are selected
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group h-full flex flex-col justify-center"
                      onDrop={(e) => void handleDrop(e)}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Drop a file here
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Any file type supported
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          All Files
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Images
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Documents
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Videos
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    // Display uploaded file
                    <div
                      className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                      onDrop={(e) => void handleDrop(e)}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                            <FileText className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            Selected File
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearFile()
                          }}
                          className="hover:bg-red-500 hover:text-red-foreground text-xs"
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <p className="font-medium text-foreground truncate text-sm">
                            {selectedFile.name}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatFileSize(selectedFile.size)}</span>
                            <span>{selectedFile.type || 'Unknown type'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Upload className="w-3 h-3" />
                          <span>Click to change file</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="*/*"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && void handleFileSelect(e.target.files)
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
                  onValueChange={(value) => void handleTabChange(value)}
                  className="flex flex-col gap-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-2 h-10">
                    <TabsTrigger
                      value="hash"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Hash className="w-4 h-4 mr-2" />
                      Hash
                    </TabsTrigger>
                    <TabsTrigger
                      value="metadata"
                      disabled={isProcessing}
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Metadata
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="hash">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-4">
                          <Shield className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-foreground">
                            File Hashes
                          </h3>
                        </div>

                        {selectedFile && (
                          <div className="flex flex-col gap-4">
                            {/* Expected Hash Input */}
                            <div className="flex flex-col gap-2">
                              <Label
                                htmlFor="expected-hash"
                                className="text-sm font-medium"
                              >
                                Expected Hash (Optional)
                              </Label>
                              <div className="flex gap-2 items-center">
                                <Input
                                  id="expected-hash"
                                  type="text"
                                  placeholder="Enter expected hash for verification"
                                  value={expectedHash}
                                  onChange={(e) =>
                                    setExpectedHash(e.target.value)
                                  }
                                  className="flex-1"
                                />
                                {expectedHash &&
                                  fileHashes &&
                                  getHashMatch() && (
                                    <div className="flex items-center gap-2">
                                      {getHashMatch()?.matches ? (
                                        <div className="flex items-center gap-1 text-green-600">
                                          <Check className="h-4 w-4" />
                                          <span className="text-xs">
                                            {getHashMatch()?.type}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-red-600">
                                          <X className="h-4 w-4" />
                                          <span className="text-xs">
                                            No match
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </div>

                            {/* Hash Progress */}
                            {hashProgress > 0 && hashProgress < 100 && (
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                  <span>Generating hashes...</span>
                                  <span>{hashProgress}%</span>
                                </div>
                                <Progress
                                  value={hashProgress}
                                  className="w-full h-2"
                                />
                              </div>
                            )}

                            {/* Hash Results */}
                            {fileHashes && (
                              <div className="flex flex-col gap-3">
                                <div className="grid grid-cols-1 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">
                                      MD5:
                                    </span>
                                    <span className="font-mono text-xs bg-background p-1 rounded">
                                      {fileHashes.md5}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">
                                      SHA1:
                                    </span>
                                    <span className="font-mono text-xs bg-background p-1 rounded">
                                      {fileHashes.sha1}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground font-medium">
                                      SHA256:
                                    </span>
                                    <span className="font-mono text-xs bg-background p-1 rounded">
                                      {fileHashes.sha256}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Loading state */}
                            {isProcessing && !fileHashes && (
                              <div className="flex items-center justify-center h-32">
                                <div className="text-center text-muted-foreground">
                                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                                  <p className="text-sm">
                                    Calculating hashes...
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!selectedFile && (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-center text-muted-foreground">
                              <p className="text-sm">
                                Select a file to generate hashes automatically
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="metadata">
                    <div className="flex flex-col gap-4">
                      {/* File Metadata Section */}
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <FileText className="h-4 w-4 text-primary" />
                            <h3 className="font-medium text-foreground">
                              File Metadata
                            </h3>
                          </div>

                          {selectedFile && (
                            <div className="flex flex-col gap-4">
                              {/* Loading state */}
                              {isProcessing && !fileMetadata && (
                                <div className="flex items-center justify-center h-32">
                                  <div className="text-center text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                                    <p className="text-sm">
                                      Extracting metadata...
                                    </p>
                                  </div>
                                </div>
                              )}

                              {fileMetadata && (
                                <div className="grid grid-cols-1 gap-3 text-sm bg-muted/50 p-4 rounded-lg">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      MIME Type:
                                    </span>
                                    <span className="font-medium">
                                      {fileMetadata.mimeType}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Description:
                                    </span>
                                    <span className="font-medium">
                                      {fileMetadata.description}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Size:
                                    </span>
                                    <span className="font-medium">
                                      {formatFileSize(fileMetadata.size)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {!selectedFile && (
                            <div className="flex items-center justify-center h-24">
                              <div className="text-center text-muted-foreground">
                                <p className="text-sm">
                                  Select a file to extract metadata
                                  automatically
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* EXIF Metadata Section */}
                      <Card className="glass-card border-0">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <Info className="h-4 w-4 text-primary" />
                            <h3 className="font-medium text-foreground">
                              EXIF Metadata
                            </h3>
                            {isExtractingExif && (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            )}
                          </div>

                          {isExtractingExif ? (
                            <div className="flex items-center justify-center h-24">
                              <div className="text-center text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                                <p className="text-sm">
                                  Extracting EXIF metadata...
                                </p>
                              </div>
                            </div>
                          ) : selectedFile?.type.startsWith('image/') &&
                            Object.keys(exifMetadata).length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 text-sm bg-muted/50 p-4 rounded-lg max-h-64 overflow-y-auto">
                              {Object.entries(exifMetadata)
                                .filter(
                                  ([, value]) =>
                                    value !== null &&
                                    value !== undefined &&
                                    value !== '',
                                )
                                .map(([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex justify-between py-1 border-b border-border/20 last:border-0"
                                  >
                                    <span className="text-muted-foreground font-medium truncate pr-2">
                                      {key}:
                                    </span>
                                    <span className="font-medium text-right">
                                      {typeof value === 'object'
                                        ? JSON.stringify(value)
                                        : String(value)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-24">
                              <div className="text-center text-muted-foreground">
                                <p className="text-sm">
                                  {selectedFile?.type.startsWith('image/')
                                    ? 'No EXIF metadata found'
                                    : 'Select an image file to view EXIF metadata'}
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
