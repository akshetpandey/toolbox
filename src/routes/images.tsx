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
import {
  acceptedImageTypes,
  isHeifImage,
  isSupportedImage,
  supportedImageFormats,
} from '@/lib/imageFiles'
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
  Crop,
  Images,
  Eraser,
} from 'lucide-react'

const imageTabs = [
  { value: 'metadata', label: 'Metadata', title: 'Image metadata', icon: Info },
  { value: 'resize', label: 'Resize', title: 'Resize image', icon: Maximize },
  {
    value: 'convert',
    label: 'Convert',
    title: 'Convert image',
    icon: Settings,
  },
  { value: 'compress', label: 'Compress', title: 'Compress image', icon: Zap },
  {
    value: 'crop',
    label: 'Crop & rotate',
    title: 'Crop, rotate and flip image',
    icon: Crop,
  },
  {
    value: 'batch',
    label: 'Batch',
    title: 'Batch resize or convert images',
    icon: Images,
  },
  { value: 'redact', label: 'Redact', title: 'Redact image', icon: Eye },
  {
    value: 'background',
    label: 'Remove background',
    title: 'Remove image background',
    icon: Eraser,
  },
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
})

function readImageDimensions(preview: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.width, height: image.height })
    image.onerror = () =>
      reject(new Error('The browser could not open this image.'))
    image.src = preview
  })
}

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
  const [isPreparing, setIsPreparing] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [batchSelectionError, setBatchSelectionError] = useState<string | null>(
    null,
  )
  const [batchFiles, setBatchFiles] = useWorkspaceState<File[]>(
    'imageBatch.files',
    [],
  )

  const [selection] = useWorkspaceState('images.selection', () => ({
    request: 0,
    activeRequest: 0,
  }))

  // Create ImageMagick processor instance - use useMemo to prevent recreation on every render
  const imageMagickProcessor = useMemo(() => new ImageMagickProcessor(), [])

  // Determine current tab from URL path
  const activeTab =
    imageTabs.find(
      ({ value }) =>
        location.pathname.replace(/\/$/, '') === `/images/${value}`,
    ) ?? imageTabs[0]
  const isBatch = activeTab.value === 'batch'

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
      const file = files[0]
      if (!file) return
      const request = ++selection.request
      const isCurrent = () => selection.request === request
      if (!isSupportedImage(file)) {
        setIsPreparing(false)
        setSelectionError('Choose a JPG, PNG, WebP, GIF, HEIC, or HEIF image.')
        return
      }
      setIsPreparing(true)
      setSelectionError(null)
      let preview = ''
      let retainedPreview = false
      try {
        if (!isHeifImage(file)) preview = URL.createObjectURL(file)
        let dimensions = preview
          ? await readImageDimensions(preview).catch(() => null)
          : null
        if (!isCurrent()) return
        if (!isInitialized) await init()
        if (!isCurrent()) return
        if (!dimensions) {
          const converted = await imageMagickProcessor.previewImage(file)
          if (!isCurrent()) return
          if (preview) URL.revokeObjectURL(preview)
          preview = URL.createObjectURL(converted.blob)
          dimensions = converted.dimensions
        }

        const imageFile: ImageFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type || (isHeifImage(file) ? 'image/heic' : ''),
          dimensions,
        }

        selection.activeRequest = request
        retainedPreview = true
        setSelectedFiles((previous) => {
          previous.forEach((image) => URL.revokeObjectURL(image.preview))
          return [imageFile]
        })
        setMetadata({})
        setExifMetadata({})
        setIsExtractingExif(false)
        invalidateImageWork()
        setIsPreparing(false)

        const isSelected = () => selection.activeRequest === request
        const readMetadata = imageMagickProcessor
          .extractMetadata(imageFile)
          .then((meta) => {
            if (isSelected()) setMetadata({ [file.name]: meta })
          })
        const readExif = extractExifMetadata(file, (extracting) => {
          if (isSelected()) setIsExtractingExif(extracting)
        }).then((exif) => {
          if (isSelected()) setExifMetadata(exif)
        })
        await Promise.allSettled([readMetadata, readExif])
      } catch {
        if (isCurrent())
          setSelectionError('This image could not be opened. Try another file.')
      } finally {
        if (!retainedPreview && preview) URL.revokeObjectURL(preview)
        if (isCurrent()) setIsPreparing(false)
      }
    },
    [
      imageMagickProcessor,
      isInitialized,
      init,
      selection,
      setSelectedFiles,
      setMetadata,
      setExifMetadata,
    ],
  )

  const clearSelectedFile = useCallback(() => {
    selection.activeRequest = ++selection.request
    setIsPreparing(false)
    setSelectionError(null)
    setSelectedFiles((previous) => {
      previous.forEach((image) => URL.revokeObjectURL(image.preview))
      return []
    })
    setMetadata({})
    setExifMetadata({})
    setIsExtractingExif(false)
    invalidateImageWork()
  }, [selection, setSelectedFiles, setMetadata, setExifMetadata])

  const replaceBatchFiles = (files: File[]) => {
    setBatchFiles(files)
    invalidateWorkspaceState(['imageBatch.options', 'result.imageBatch.'])
  }

  const contextValue: ImageToolsContextType = {
    selectedFile: selectedFiles[0] || null,
    batchFiles,
    clearBatchFiles: () => replaceBatchFiles([]),
    initImageTools: init,
    metadata,
    exifMetadata,
    isExtractingExif,
    imageMagickProcessor,
    isProcessing,
    handleFileSelect,
    clearSelectedFile,
  }

  const imageFileUpload = isBatch ? (
    <FileUpload
      selectedFiles={batchFiles.map(({ name, size }) => ({ name, size }))}
      onFileSelect={(files) => {
        const selected = Array.from(files)
        if (selected.some((file) => !isSupportedImage(file))) {
          setBatchSelectionError('Choose only image files for a batch.')
          return
        }
        setBatchSelectionError(null)
        replaceBatchFiles(selected)
      }}
      onClearFiles={() => {
        setBatchSelectionError(null)
        replaceBatchFiles([])
      }}
      disabled={isProcessing}
      acceptedTypes={acceptedImageTypes}
      title="Drop images here"
      description="Apply the same changes to every selected image."
      supportedFormats={supportedImageFormats}
      selectedActionLabel="Change files"
      multiple
    />
  ) : (
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
      disabled={isProcessing || isPreparing}
      acceptedTypes={acceptedImageTypes}
      title="Drop an image here"
      description="Choose an image from this device."
      supportedFormats={supportedImageFormats}
      selectedFileIcon={FileImage}
    >
      {/* Custom file display for images */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {selectedFiles.map((file) => (
            <div key={file.name} className="flex min-w-0 items-start gap-3">
              <div className="shrink-0">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg bg-muted/20"
                />
              </div>
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
    <ResponsiveTabs
      tabs={imageTabs}
      currentTab={activeTab.value}
      onTabChange={handleTabChange}
      isProcessing={isProcessing}
    />
  )
  const uploadError = isBatch ? batchSelectionError : selectionError

  return (
    <ImageToolsContext.Provider value={contextValue}>
      <ToolLayout
        title={activeTab.title}
        icon={ImageIcon}
        iconColor="text-blue-500"
        iconBgColor="bg-gradient-to-br from-blue-500/10 to-blue-500/5"
        fileUploadComponent={
          <div className="space-y-3">
            {imageFileUpload}
            {((!isBatch && isPreparing) || isInitializing) && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />{' '}
                Preparing image tools…
              </p>
            )}
            {(uploadError ?? error) && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError ?? 'Image tools could not load. Try again.'}
              </p>
            )}
          </div>
        }
        navigationComponent={imageToolsNav}
      >
        <div inert={!isBatch && isPreparing}>
          <Outlet />
        </div>
      </ToolLayout>
    </ImageToolsContext.Provider>
  )
}
