import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { useInitFFmpeg } from '@/hooks/useInitFFmpeg'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import {
  FFmpegProcessor,
  type VideoFile,
  type VideoMetadata,
} from '@/lib/ffmpeg'
import { formatFileSize, formatDuration } from '@/lib/shared'
import { useProcessing } from '@/contexts/ProcessingContext'
import {
  VideoToolsContext,
  type VideoToolsContextType,
} from '@/contexts/VideoToolsContext'

import {
  Upload,
  Info,
  FileVideo,
  Settings,
  Zap,
  Scissors,
  Volume2,
  Loader2,
  Video as VideoIcon,
} from 'lucide-react'

const videoTabs = [
  { value: 'metadata', label: 'Metadata', icon: Info },
  { value: 'convert', label: 'Convert', icon: Settings },
  { value: 'compress', label: 'Compress', icon: Zap },
  { value: 'trim', label: 'Trim', icon: Scissors },
  { value: 'extract', label: 'Extract', icon: Volume2 },
]

export const Route = createFileRoute('/videos')({
  component: VideoToolsLayout,
  head: () => ({
    meta: [
      {
        title: 'Video Tools - Free Browser-Based Video Processing | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based video processing tools. Convert, compress, trim, extract audio, and view metadata of videos entirely in your browser. No uploads required.',
      },
      {
        name: 'keywords',
        content:
          'free video tools, video converter, video compressor, video editor, browser video processing, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Video Tools - Free Browser-Based Video Processing',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based video processing tools. Process videos entirely in your browser with complete privacy.',
      },
    ],
  }),
})

// Helper function to format time in seconds to human-readable format
const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`
  } else if (mins > 0) {
    return `${mins}m ${secs}s`
  } else {
    return `${secs}s`
  }
}

// Video-specific file upload component
function VideoFileUpload({
  selectedFiles,
  onFileSelect,
  onClear,
  disabled,
  showPreview,
}: {
  selectedFiles: VideoFile[]
  onFileSelect: (files: FileList) => Promise<void>
  onClear: () => void
  disabled: boolean
  showPreview: boolean
}) {
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  // Convert VideoFile to simple format for FileUpload component
  const simpleFiles = selectedFiles.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    preview: file.preview,
    duration: file.duration,
    dimensions: file.dimensions,
  }))

  return (
    <FileUpload
      selectedFiles={simpleFiles}
      disabled={disabled}
      onFileSelect={(files) => void onFileSelect(files)}
      onClearFiles={onClear}
      acceptedTypes="video/*,.mp4,.webm,.avi,.mov,.mkv"
      title="Drop a video here"
      description="Supports MP4, WebM, AVI, MOV, MKV"
      supportedFormats={['MP4', 'WebM', 'AVI', 'MOV', 'MKV']}
      emptyStateIcon={Upload}
      selectedFileIcon={FileVideo}
    >
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            {selectedFiles.map((file) => (
              <div key={file.name} className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground truncate text-sm">
                    {file.name}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    {file.dimensions && (
                      <span>
                        {file.dimensions.width} × {file.dimensions.height}
                      </span>
                    )}
                  </div>
                  {file.duration && (
                    <div className="text-xs text-muted-foreground">
                      Duration: {formatDuration(file.duration)}
                    </div>
                  )}
                </div>
                <details open={showPreview} className="mt-2">
                  <summary className="cursor-pointer py-2 text-sm font-medium">
                    Preview video
                  </summary>
                  <video
                    aria-label="Source video preview"
                    src={file.preview}
                    className="mt-2 max-h-64 w-full rounded-lg bg-muted"
                    controls
                    preload="metadata"
                    onError={() => setFailedPreview(file.preview)}
                  />
                  {failedPreview === file.preview && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Preview is unavailable for this video. You can still
                      process the file.
                    </p>
                  )}
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </FileUpload>
  )
}

// Video tools component with tabs and outlet
function VideoTools({
  currentTab,
  onTabChange,
  isProcessing,
}: {
  currentTab: string
  onTabChange: (tab: string) => void
  isProcessing: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="w-full">
        <ResponsiveTabs
          tabs={videoTabs}
          currentTab={currentTab}
          onTabChange={onTabChange}
          isProcessing={isProcessing}
        />
      </div>
      <Outlet />
    </div>
  )
}

function VideoToolsLayout() {
  const { ffmpeg, isInitialized, error, init, setProgressCallback } =
    useInitFFmpeg()
  const { isProcessing, setIsProcessing } = useProcessing()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedFiles, setSelectedFiles] = useWorkspaceState<VideoFile[]>(
    'videos.files',
    [],
  )
  const [metadata, setMetadata] = useWorkspaceState<
    Record<string, VideoMetadata>
  >('videos.metadata', {})
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparationMessage, setPreparationMessage] = useState(
    'Preparing video tools…',
  )
  const [preparationError, setPreparationError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressStartTime, setProgressStartTime] = useState<number | null>(
    null,
  )
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<
    string | null
  >(null)
  const [elapsedTime, setElapsedTime] = useState<string | null>(null)
  const [showSlowProcessingWarning, setShowSlowProcessingWarning] =
    useState(false)
  const [currentAbortController, setCurrentAbortController] =
    useState<AbortController | null>(null)

  // Create FFmpeg processor instance
  const ffmpegProcessorRef = useRef<FFmpegProcessor | null>(null)
  const fileSelectionId = useRef(0)
  const fileSelectionTask = useRef(Promise.resolve())
  const getFfmpegProcessor = useCallback(
    async (input?: VideoFile): Promise<FFmpegProcessor> => {
      let processor = ffmpegProcessorRef.current
      if (!processor) {
        const core = isInitialized ? ffmpeg! : await init()
        if (!core) throw new Error('Failed to initialize video tools')
        processor = new FFmpegProcessor(core)
        ffmpegProcessorRef.current = processor
      }
      const selected = input ?? selectedFiles[0]
      if (selected && processor.inputFile?.file !== selected.file)
        await processor.mountInputFile(selected)
      return processor
    },
    [isInitialized, ffmpeg, init, selectedFiles],
  )

  useEffect(() => {
    return () => {
      fileSelectionId.current++
      setIsProcessing(false)
      void fileSelectionTask.current
        .then(() => ffmpegProcessorRef.current?.unmountInputFile())
        .catch(console.error)
    }
  }, [setIsProcessing])

  // Determine current tab from URL path
  const currentTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/metadata')) return 'metadata'
    if (path.includes('/convert')) return 'convert'
    if (path.includes('/compress')) return 'compress'
    if (path.includes('/trim')) return 'trim'
    if (path.includes('/extract')) return 'extract'
    return 'metadata' // default
  }, [location.pathname])

  // Handle tab changes
  const handleTabChange = useCallback(
    (value: string) => {
      if (isProcessing) return // Prevent tab changes while processing

      void navigate({
        to: `/videos/${value}`,
      })
    },
    [navigate, isProcessing],
  )

  // Set up progress callback
  useEffect(() => {
    const handleProgress = (progressValue: number) => {
      const progressPercent = Math.round(progressValue * 1000) / 10
      setProgress(progressPercent)

      const now = Date.now()
      if (progressStartTime && progressPercent > 0) {
        const elapsed = now - progressStartTime
        const elapsedSeconds = Math.floor(elapsed / 1000)
        const elapsedStr = formatTime(elapsedSeconds)
        setElapsedTime(elapsedStr)

        const estimatedTotalTime = elapsed / (progressPercent / 100)
        const remainingTime = estimatedTotalTime - elapsed
        const remainingSeconds = Math.floor(remainingTime / 1000)

        if (estimatedTotalTime > 1800000 && !showSlowProcessingWarning) {
          setShowSlowProcessingWarning(true)
        }

        if (remainingSeconds > 0 && progressPercent < 100) {
          setEstimatedTimeRemaining(formatTime(remainingSeconds))
        } else {
          setEstimatedTimeRemaining(null)
        }
      }
    }

    setProgressCallback(handleProgress)
  }, [setProgressCallback, progressStartTime, showSlowProcessingWarning])

  // Prevent navigation away while processing
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isProcessing) {
        event.preventDefault()
        event.returnValue =
          'Video processing is in progress. Are you sure you want to leave? Your progress will be lost.'
      }
    }

    if (isProcessing) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isProcessing])

  const prepareVideoFile = useCallback(
    async (videoFile: VideoFile) => {
      const selectionId = ++fileSelectionId.current
      setIsPreparing(true)
      setPreparationMessage('Preparing video tools…')
      setPreparationError(null)
      // FFprobe supports containers/codecs the native <video> element cannot
      // decode (including many AVI/MKV files). Preview support is optional.
      try {
        const task = fileSelectionTask.current.then(async () => {
          if (selectionId !== fileSelectionId.current) return
          const processor = await getFfmpegProcessor(videoFile)
          setPreparationMessage('Reading video information…')
          if (selectionId !== fileSelectionId.current) return
          const meta = await processor.extractMetadata()
          if (selectionId !== fileSelectionId.current) return
          setMetadata({ [videoFile.name]: meta })
          setSelectedFiles([
            {
              ...videoFile,
              ...(meta.width > 0 && meta.height > 0
                ? { dimensions: { width: meta.width, height: meta.height } }
                : {}),
              ...(Number.isFinite(meta.duration) && meta.duration > 0
                ? { duration: meta.duration }
                : {}),
            },
          ])
        })
        fileSelectionTask.current = task.catch(() => {
          // The current caller reports errors; future selections may retry.
        })
        await task
      } catch (error) {
        console.error('🎬 VideoTools: Error extracting metadata:', error)
        if (selectionId === fileSelectionId.current)
          setPreparationError(
            'We could not prepare this video. Choose another file or try replacing it.',
          )
      } finally {
        if (selectionId === fileSelectionId.current) setIsPreparing(false)
      }
    },
    [getFfmpegProcessor, setMetadata, setSelectedFiles],
  )

  useEffect(() => {
    const file = selectedFiles[0]
    if (file && !metadata[file.name] && !isPreparing && !preparationError)
      void prepareVideoFile(file)
  }, [selectedFiles, metadata, isPreparing, preparationError, prepareVideoFile])

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🎬 VideoTools: File selection started', {
        fileCount: files.length,
      })

      const file = files[0]
      if (
        file &&
        (file.type.startsWith('video/') ||
          /\.(mp4|webm|avi|mov|mkv)$/i.test(file.name))
      ) {
        console.log('🎬 VideoTools: Processing video file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        for (const previous of selectedFiles)
          URL.revokeObjectURL(previous.preview)
        const preview = URL.createObjectURL(file)
        const videoFile: VideoFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type,
        }

        setSelectedFiles([videoFile])
        setMetadata({})

        await prepareVideoFile(videoFile)
      }
    },
    [prepareVideoFile, selectedFiles, setSelectedFiles, setMetadata],
  )

  const clearSelectedFile = useCallback(() => {
    fileSelectionId.current++
    void fileSelectionTask.current
      .then(() => ffmpegProcessorRef.current?.unmountInputFile())
      .catch(console.error)
    setIsProcessing(false)
    setIsPreparing(false)
    setPreparationError(null)
    for (const file of selectedFiles) URL.revokeObjectURL(file.preview)
    setSelectedFiles([])
    setMetadata({})
    setProgress(0)
    setProgressStartTime(null)
    setEstimatedTimeRemaining(null)
    setElapsedTime(null)
    setShowSlowProcessingWarning(false)
    setCurrentAbortController(null)
  }, [setIsProcessing, selectedFiles, setSelectedFiles, setMetadata])

  const cancelProcessing = useCallback(() => {
    if (currentAbortController) {
      console.log('🎬 VideoTools: Cancelling current processing operation')
      currentAbortController.abort('User cancelled')
    }
  }, [currentAbortController])

  const contextValue: VideoToolsContextType = useMemo(
    () => ({
      selectedFile: selectedFiles[0] || null,
      metadata,
      ffmpegProcessor: ffmpegProcessorRef.current,
      isProcessing,
      isPreparing,
      progress,
      progressStartTime,
      estimatedTimeRemaining,
      elapsedTime,
      showSlowProcessingWarning,
      currentAbortController,
      handleFileSelect,
      clearSelectedFile,
      setProgress,
      setProgressStartTime,
      setEstimatedTimeRemaining,
      setElapsedTime,
      setShowSlowProcessingWarning,
      setCurrentAbortController,
      getFfmpegProcessor,
      setIsProcessing,
      cancelProcessing,
    }),
    [
      selectedFiles,
      metadata,
      isProcessing,
      isPreparing,
      progress,
      progressStartTime,
      estimatedTimeRemaining,
      elapsedTime,
      showSlowProcessingWarning,
      currentAbortController,
      handleFileSelect,
      clearSelectedFile,
      getFfmpegProcessor,
      setIsProcessing,
      cancelProcessing,
    ],
  )

  return (
    <VideoToolsContext.Provider value={contextValue}>
      <ToolLayout
        title={
          {
            metadata: 'Video information',
            convert: 'Convert video',
            compress: 'Compress video',
            trim: 'Trim video',
            extract: 'Extract audio',
          }[currentTab] ?? 'Video tools'
        }
        icon={VideoIcon}
        iconColor="text-purple-500"
        iconBgColor="bg-gradient-to-br from-purple-500/10 to-purple-500/5"
        fileUploadComponent={
          <VideoFileUpload
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            onClear={clearSelectedFile}
            disabled={isPreparing || isProcessing}
            showPreview={currentTab === 'trim'}
          />
        }
        toolsComponent={
          <div className="space-y-5">
            {isPreparing && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {preparationMessage}
              </div>
            )}
            {(preparationError ?? error) && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              >
                {preparationError ??
                  'Video tools could not load. Check your connection, then replace the file to try again.'}
              </div>
            )}
            {!isPreparing &&
              !isProcessing &&
              selectedFiles[0] &&
              metadata[selectedFiles[0].name] &&
              !preparationError &&
              !error && (
                <p role="status" className="text-sm text-muted-foreground">
                  Ready to process. Your video stays on this device.
                </p>
              )}
            <VideoTools
              currentTab={currentTab}
              onTabChange={handleTabChange}
              isProcessing={isProcessing}
            />
          </div>
        }
      />
    </VideoToolsContext.Provider>
  )
}
