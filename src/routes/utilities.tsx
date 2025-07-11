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
import {
  extractExifMetadata,
  extractFileMetadata,
  calculateFileHashes,
  formatFileSize,
  type ExifMetadata,
  type FileMetadata,
  type FileHashes,
} from '@/lib/metadata'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  UtilitiesContext,
  type UtilitiesContextType,
  type UploadedFile,
} from '@/contexts/UtilitiesContext'

import { Upload, Hash, Info, FileText, Settings } from 'lucide-react'

export const Route = createFileRoute('/utilities')({
  component: UtilitiesLayout,
})

function UtilitiesLayout() {
  const { isProcessing, setIsProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null)
  const [exifMetadata, setExifMetadata] = useState<ExifMetadata>({})
  const [fileHashes, setFileHashes] = useState<FileHashes | null>(null)
  const [expectedHash, setExpectedHash] = useState('')
  const [isExtractingExif, setIsExtractingExif] = useState(false)
  const [hashProgress, setHashProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/hash')) return 'hash'
    if (path.includes('/metadata')) return 'metadata'
    return 'hash' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/utilities/${value}`,
      })
    },
    [navigate, isProcessing],
  )

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
        setIsExtractingExif(false)
        setHashProgress(0)

        console.log('🔧 UtilitiesTools: File selection completed successfully')

        // Auto-generate hashes when file is selected and on hash tab
        if (currentTab === 'hash') {
          await generateHashes(uploadedFile)
        }

        // Auto-extract metadata when file is selected and on metadata tab
        if (currentTab === 'metadata') {
          await extractMetadata(uploadedFile)
        }
      }
    },
    [currentTab],
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
    setIsExtractingExif(false)
    setHashProgress(0)
  }

  // Context value
  const contextValue: UtilitiesContextType = {
    selectedFile,
    setSelectedFile,
    fileMetadata,
    setFileMetadata,
    exifMetadata,
    setExifMetadata,
    fileHashes,
    setFileHashes,
    expectedHash,
    setExpectedHash,
    isExtractingExif,
    setIsExtractingExif,
    hashProgress,
    setHashProgress,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    clearFile,
    generateHashes,
    extractMetadata,
  }

  return (
    <UtilitiesContext.Provider value={contextValue}>
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
                    value={currentTab}
                    onValueChange={handleTabChange}
                    className="flex flex-col gap-4"
                  >
                    <TabsList className="flat-card border-0 grid w-full grid-cols-2 h-10">
                      <TabsTrigger
                        value="hash"
                        disabled={isProcessing}
                        className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Hash className="w-4 h-4 mr-2" />
                        Hash
                      </TabsTrigger>
                      <TabsTrigger
                        value="metadata"
                        disabled={isProcessing}
                        className="text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Info className="w-4 h-4 mr-2" />
                        Metadata
                      </TabsTrigger>
                    </TabsList>
                    <div>
                      <Outlet />
                    </div>
                  </Tabs>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UtilitiesContext.Provider>
  )
}
