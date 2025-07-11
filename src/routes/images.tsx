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
import { useInitImageMagick } from '@/hooks/useInitImageMagick'
import {
  ImageMagickProcessor,
  type ImageFile,
  type ImageMetadata,
  formatFileSize,
} from '@/lib/imagemagick'
import { extractExifMetadata, type ExifMetadata } from '@/lib/metadata'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  ImageToolsContext,
  type ImageToolsContextType,
} from '@/contexts/ImageToolsContext'
import {
  Upload,
  Image as ImageIcon,
  Info,
  Maximize,
  FileImage,
  Loader2,
  Settings,
  Zap,
  Eye,
} from 'lucide-react'

export const Route = createFileRoute('/images')({
  component: ImageToolsLayout,
})

function ImageToolsLayout() {
  const { isInitialized, isInitializing, error, init } = useInitImageMagick()
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useState<ImageFile[]>([])
  const [metadata, setMetadata] = useState<Record<string, ImageMetadata>>({})
  const [exifMetadata, setExifMetadata] = useState<ExifMetadata>({})
  const [isExtractingExif, setIsExtractingExif] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Create ImageMagick processor instance - use useMemo to prevent recreation on every render
  const imageMagickProcessor = useMemo(() => new ImageMagickProcessor(), [])

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/metadata')) return 'metadata'
    if (path.includes('/resize')) return 'resize'
    if (path.includes('/convert')) return 'convert'
    if (path.includes('/compress')) return 'compress'
    if (path.includes('/redact')) return 'redact'
    return 'metadata' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/images/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🖼️ ImageTools: File selection started', {
        fileCount: files.length,
      })

      // Only take the first image file
      const file = files[0]
      if (file?.type.startsWith('image/')) {
        console.log('🖼️ ImageTools: Processing image file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const preview = URL.createObjectURL(file)

        // Get image dimensions
        const img = new Image()
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve) => {
            img.onload = () => resolve({ width: img.width, height: img.height })
            img.src = preview
          },
        )

        console.log('🖼️ ImageTools: Image dimensions extracted', dimensions)

        const imageFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type,
          dimensions,
        }

        setSelectedFiles([imageFile])
        setMetadata({})
        setExifMetadata({})
        setIsExtractingExif(false)

        // Initialize ImageMagick if not already initialized
        if (!isInitialized) {
          console.log('🖼️ ImageTools: Initializing ImageMagick...')
          await init()
          console.log('🖼️ ImageTools: ImageMagick initialization completed')
        }

        // Automatically extract both ImageMagick and EXIF metadata
        console.log('🖼️ ImageTools: Starting metadata extraction...')
        await Promise.all([
          extractMetadata(imageFile),
          extractImageExifMetadata(imageFile),
        ])
        console.log('🖼️ ImageTools: File selection completed successfully')
      } else {
        console.warn('🖼️ ImageTools: Invalid file type selected', {
          type: file?.type,
        })
      }
    },
    [isInitialized, init],
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

  // Extract metadata using ImageMagick
  const extractMetadata = async (imageFile: ImageFile) => {
    console.log(
      '🖼️ ImageTools: Starting metadata extraction for',
      imageFile.name,
    )
    try {
      const meta = await imageMagickProcessor.extractMetadata(imageFile)
      console.log('🖼️ ImageTools: Metadata extraction successful', meta)
      setMetadata((prev) => ({ ...prev, [imageFile.name]: meta }))
    } catch (error) {
      console.error('🖼️ ImageTools: Error extracting metadata:', error)
      // Fallback to basic metadata
      const meta: ImageMetadata = {
        width: imageFile.dimensions?.width ?? 0,
        height: imageFile.dimensions?.height ?? 0,
        format: imageFile.type.split('/')[1].toUpperCase(),
        size: imageFile.size,
        colorspace: 'sRGB',
        depth: 8,
        compression: 'None',
      }
      console.log('🖼️ ImageTools: Using fallback metadata', meta)
      setMetadata((prev) => ({ ...prev, [imageFile.name]: meta }))
    }
  }

  // Extract EXIF metadata using shared metadata library
  const extractImageExifMetadata = async (imageFile: ImageFile) => {
    try {
      const exifData = await extractExifMetadata(
        imageFile.file,
        setIsExtractingExif,
      )
      setExifMetadata((prev) => ({ ...prev, ...exifData }))
    } catch (error) {
      console.error('🖼️ ImageTools: Error extracting EXIF metadata:', error)
      setExifMetadata((prev) => ({ ...prev, ...{} }))
    }
  }

  const clearSelectedFile = useCallback(() => {
    setSelectedFiles([])
    setMetadata({})
    setExifMetadata({})
    setIsExtractingExif(false)
  }, [])

  // Create context value
  const contextValue: ImageToolsContextType = {
    selectedFile: selectedFiles[0] || null,
    metadata,
    exifMetadata,
    isExtractingExif,
    imageMagickProcessor,
    isProcessing,
    handleFileSelect,
    clearSelectedFile,
  }

  if (isInitializing) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-center h-screen w-full bg-background/80 z-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="text-lg text-foreground">
              Loading image tools...
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center justify-center h-screen w-full bg-background/80 z-50">
          <div className="flex flex-col items-center gap-4">
            <span className="text-lg text-red-500">
              Failed to load image tools: {error}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ImageToolsContext.Provider value={contextValue}>
      <div className="flex flex-col h-full bg-background">
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="glass border-b border-border/50">
            <div className="container mx-auto p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <h1 className="text-heading text-foreground">
                      Image Tools
                    </h1>
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
                          onDrop={(e) => void handleDrop(e)}
                          onDragOver={handleDragOver}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Upload className="h-6 w-6 text-primary" />
                          </div>
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Drop an image here
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Supports JPG, PNG, WebP, GIF
                          </p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              JPG
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              PNG
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              WebP
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              GIF
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
                                <FileImage className="h-3 w-3 text-primary" />
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                Selected Image
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                clearSelectedFile()
                              }}
                              className="hover:bg-red-500 hover:text-red-foreground text-xs"
                            >
                              Clear
                            </Button>
                          </div>

                          <div className="flex flex-col gap-2">
                            {selectedFiles.map((file) => (
                              <div
                                key={file.name}
                                className="flex flex-col gap-2"
                              >
                                <div className="relative">
                                  <img
                                    src={file.preview}
                                    alt={file.name}
                                    className="w-full max-h-64 object-contain rounded-lg bg-muted/20"
                                    style={{
                                      minHeight:
                                        file.dimensions &&
                                        file.dimensions.height >
                                          file.dimensions.width
                                          ? '200px'
                                          : '120px',
                                    }}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <p className="font-medium text-foreground truncate text-sm">
                                    {file.name}
                                  </p>
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{formatFileSize(file.size)}</span>
                                    {file.dimensions && (
                                      <span>
                                        {file.dimensions.width} ×{' '}
                                        {file.dimensions.height}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                              <Upload className="w-3 h-3" />
                              <span>Click to change image</span>
                            </div>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files &&
                          void handleFileSelect(e.target.files)
                        }
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
                        <TabsList className="grid w-full grid-cols-5">
                          <TabsTrigger
                            value="metadata"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Info className="w-4 h-4" />
                            Metadata
                          </TabsTrigger>
                          <TabsTrigger
                            value="resize"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Maximize className="w-4 h-4" />
                            Resize
                          </TabsTrigger>
                          <TabsTrigger
                            value="convert"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            Convert
                          </TabsTrigger>
                          <TabsTrigger
                            value="compress"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Zap className="w-4 h-4" />
                            Compress
                          </TabsTrigger>
                          <TabsTrigger
                            value="redact"
                            disabled={isProcessing}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            Redact
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
      </div>
    </ImageToolsContext.Provider>
  )
}
