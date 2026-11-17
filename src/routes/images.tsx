import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { MessageError } from '@/i18n/MessageError'
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  invalidateWorkspaceState,
  useWorkspaceState,
} from '@/hooks/useWorkspaceState'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
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
  ScanText,
} from 'lucide-react'

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
      reject(new MessageError('imagesTheBrowserCouldNotOpenThis'))
    image.src = preview
  })
}

const pendingImageDetails = new WeakMap<
  File,
  { magick: Promise<ImageMetadata>; exif: Promise<ExifMetadata> }
>()
function imageDetails(image: ImageFile, processor: ImageMagickProcessor) {
  const pending = pendingImageDetails.get(image.file)
  if (pending) return pending
  const details = {
    magick: processor.extractMetadata(image),
    exif: extractExifMetadata(image.file),
  }
  pendingImageDetails.set(image.file, details)
  return details
}

function ImageToolsLayout() {
  const t = useTranslator()
  const imageTabs = [
    {
      value: 'ocr',
      label: t('imagesImageToText'),
      title: t('imagesImageToTextOCR'),
      icon: ScanText,
    },
    {
      value: 'metadata',
      label: t('imagesMetadata'),
      title: t('imagesImageMetadata'),
      icon: Info,
    },
    {
      value: 'resize',
      label: t('imagesResize'),
      title: t('imagesResizeImage'),
      icon: Maximize,
    },
    {
      value: 'convert',
      label: t('imagesConvert'),
      title: t('imagesConvertImage'),
      icon: Settings,
    },
    {
      value: 'compress',
      label: t('imagesCompress'),
      title: t('imagesCompressImage'),
      icon: Zap,
    },
    {
      value: 'crop',
      label: t('imagesCropRotate'),
      title: t('imagesCropRotateAndFlipImage'),
      icon: Crop,
    },
    {
      value: 'batch',
      label: t('imagesBatch'),
      title: t('imagesBatchResizeOrConvertImages'),
      icon: Images,
    },
    {
      value: 'redact',
      label: t('imagesRedact'),
      title: t('imagesRedactImage'),
      icon: Eye,
    },
    {
      value: 'background',
      label: t('imagesRemoveBackground'),
      title: t('imagesRemoveImageBackground'),
      icon: Eraser,
    },
  ]
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
    ) ?? imageTabs.find(({ value }) => value === 'metadata')!
  const isBatch = activeTab.value === 'batch'

  const showMetadata = activeTab.value === 'metadata'
  const selected = selectedFiles[0]
  useEffect(() => {
    if (!showMetadata || !selected) return
    let active = true
    const request = selection.activeRequest
    const isCurrent = () => active && selection.activeRequest === request
    const job = imageDetails(selected, imageMagickProcessor)
    setIsExtractingExif(true)
    void job.magick.then((details) => {
      if (isCurrent()) setMetadata({ [selected.name]: details })
    })
    void job.exif.then((details) => {
      if (isCurrent()) {
        setExifMetadata(details)
        setIsExtractingExif(false)
      }
    })
    return () => {
      active = false
    }
  }, [
    showMetadata,
    selected,
    selection,
    imageMagickProcessor,
    setMetadata,
    setExifMetadata,
  ])

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
        setSelectionError(t('imagesChooseAJPGPNGWebPGIF'))
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
      } catch {
        if (isCurrent()) setSelectionError(t('imagesThisImageCouldNotBeOpened'))
      } finally {
        if (!retainedPreview && preview) URL.revokeObjectURL(preview)
        if (isCurrent()) setIsPreparing(false)
      }
    },
    [
      imageMagickProcessor,
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
          setBatchSelectionError(t('imagesChooseOnlyImageFilesForA'))
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
      title={t('imagesDropImagesHere')}
      description={t('imagesApplyTheSameChangesToEvery')}
      supportedFormats={supportedImageFormats}
      selectedActionLabel={t('imagesChangeFiles')}
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
      title={t('imagesDropAnImageHere')}
      description={t('imagesChooseAnImageFromThisDevice')}
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
                  <span>{formatFileSize(file.size, t)}</span>
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
            {!isBatch && isPreparing && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />{' '}
                {t('imagesPreparingImageTools')}
              </p>
            )}
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
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
