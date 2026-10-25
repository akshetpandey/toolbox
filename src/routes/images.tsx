import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { useInitImageMagick } from '@/hooks/useInitImageMagick'
import {
  ImageMagickProcessor,
  type ImageMetadata,
  formatFileSize,
} from '@/lib/imagemagick'
import { type ImageFile } from '@/lib/shared'
import { extractExifMetadata, type ExifMetadata } from '@/lib/metadata'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  ImageToolsContext,
  type ImageToolsContextType,
} from '@/contexts/ImageToolsContext'
import {
  Image as ImageIcon,
  Info,
  Maximize,
  FileImage,
  Loader2,
  Settings,
  Zap,
  Eye,
} from 'lucide-react'

const imageTabs = [
  { value: 'metadata', label: 'Metadata', icon: Info },
  { value: 'resize', label: 'Resize', icon: Maximize },
  { value: 'convert', label: 'Convert', icon: Settings },
  { value: 'compress', label: 'Compress', icon: Zap },
  { value: 'redact', label: 'Redact', icon: Eye },
]

function invalidateImageWork() {
  invalidateWorkspaceState(['images.', 'result.images.'], {
    // These provider-owned values are reset explicitly with each selection.
    // Keep their setters live for the new file's asynchronous metadata work.
    preserve: [
      'images.files',
      'images.metadata',
      'images.exif',
      'images.selection',
    ],
  })
}

export const Route = createFileRoute('/images')({
  component: ImageToolsLayout,
  head: () => ({
    meta: [
      {
        title: 'Image Tools - Free Browser-Based Image Processing | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based image processing tools. Compress, convert, resize, redact, and view metadata of images entirely in your browser. No uploads required.',
      },
      {
        name: 'keywords',
        content:
          'free image tools, image converter, image compressor, image resizer, browser image editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Image Tools - Free Browser-Based Image Processing',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based image processing tools. Process images entirely in your browser with complete privacy.',
      },
    ],
  }),
})

function ImageToolsLayout() {
  const { isInitialized, isInitializing, error, init } = useInitImageMagick()
  const { isProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useWorkspaceState<ImageFile[]>(
    'images.files',
    [],
  )
  const [metadata, setMetadata] = useWorkspaceState<
    Record<string, ImageMetadata>
  >('images.metadata', {})
  const [exifMetadata, setExifMetadata] = useWorkspaceState<ExifMetadata>(
    'images.exif',
    {},
  )
  const [isExtractingExif, setIsExtractingExif] = useState(false)

  const [selection] = useWorkspaceState('images.selection', () => ({
    file: null as File | null,
  }))

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

        selection.file = file
        const preview = URL.createObjectURL(file)

        // Get image dimensions
        const img = new Image()
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve) => {
            img.onload = () => resolve({ width: img.width, height: img.height })
            img.src = preview
          },
        )

        if (selection.file !== file) {
          URL.revokeObjectURL(preview)
          return
        }
        console.log('🖼️ ImageTools: Image dimensions extracted', dimensions)

        const imageFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type,
          dimensions,
        }

        setSelectedFiles((previous) => {
          previous.forEach((image) => URL.revokeObjectURL(image.preview))
          return [imageFile]
        })
        setMetadata({})
        setExifMetadata({})
        setIsExtractingExif(false)
        invalidateImageWork()

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
    [
      isInitialized,
      init,
      selection,
      setSelectedFiles,
      setMetadata,
      setExifMetadata,
    ],
  )

  // Extract metadata using ImageMagick
  const extractMetadata = async (imageFile: ImageFile) => {
    console.log(
      '🖼️ ImageTools: Starting metadata extraction for',
      imageFile.name,
    )
    try {
      const meta = await imageMagickProcessor.extractMetadata(imageFile)
      console.log('🖼️ ImageTools: Metadata extraction successful', meta)
      if (selection.file === imageFile.file)
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
      if (selection.file === imageFile.file)
        setMetadata((prev) => ({ ...prev, [imageFile.name]: meta }))
    }
  }

  // Extract EXIF metadata using shared metadata library
  const extractImageExifMetadata = async (imageFile: ImageFile) => {
    try {
      const exifData = await extractExifMetadata(
        imageFile.file,
        (extracting) => {
          if (selection.file === imageFile.file) setIsExtractingExif(extracting)
        },
      )
      if (selection.file === imageFile.file) setExifMetadata(exifData)
    } catch (error) {
      console.error('🖼️ ImageTools: Error extracting EXIF metadata:', error)
      if (selection.file === imageFile.file) setExifMetadata({})
    }
  }

  const clearSelectedFile = useCallback(() => {
    selection.file = null
    setSelectedFiles((previous) => {
      previous.forEach((image) => URL.revokeObjectURL(image.preview))
      return []
    })
    setMetadata({})
    setExifMetadata({})
    setIsExtractingExif(false)
    invalidateImageWork()
  }, [selection, setSelectedFiles, setMetadata, setExifMetadata])

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

  const imageFileUpload = (
    <FileUpload
      selectedFiles={selectedFiles.map((file) => ({
        name: file.name,
        size: file.size,
        preview: file.preview,
        dimensions: file.dimensions,
        type: file.type,
      }))}
      onFileSelect={(files) => void handleFileSelect(files)}
      onClearFiles={clearSelectedFile}
      disabled={isProcessing}
      acceptedTypes="image/*"
      title="Drop an image here"
      description="Supports JPG, PNG, WebP, GIF"
      supportedFormats={['JPG', 'PNG', 'WebP', 'GIF']}
      selectedFileIcon={FileImage}
    >
      {/* Custom file display for images */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {selectedFiles.map((file) => (
            <div key={file.name} className="flex min-w-0 items-start gap-3">
              {currentTab !== 'redact' && (
                <div className="shrink-0">
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg bg-muted/20"
                  />
                </div>
              )}
              <div className="min-w-0 flex flex-col gap-1">
                <p className="font-medium text-foreground break-all text-sm">
                  {file.name}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  {file.dimensions && (
                    <span>
                      {file.dimensions.width} × {file.dimensions.height}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </FileUpload>
  )

  const imageToolsNav = (
    <div className="w-full">
      <ResponsiveTabs
        tabs={imageTabs}
        currentTab={currentTab}
        onTabChange={handleTabChange}
        isProcessing={isProcessing}
      />
    </div>
  )

  return (
    <ImageToolsContext.Provider value={contextValue}>
      <ToolLayout
        title={
          {
            metadata: 'Image metadata',
            resize: 'Resize image',
            convert: 'Convert image',
            compress: 'Compress image',
            redact: 'Redact image',
          }[currentTab]
        }
        icon={ImageIcon}
        iconColor="text-blue-500"
        iconBgColor="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
        fileUploadComponent={imageFileUpload}
        toolsComponent={imageToolsNav}
      >
        <Outlet />
      </ToolLayout>
    </ImageToolsContext.Provider>
  )
}
