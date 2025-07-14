import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ResponsiveTabs } from '@/components/ui/responsive-tabs'
import { ToolLayout } from '@/components/ToolLayout'
import { FileUpload } from '@/components/FileUpload'
import { useInitFFmpeg } from '@/hooks/useInitFFmpeg'
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
  X,
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
}: {
  selectedFiles: VideoFile[]
  onFileSelect: (files: FileList) => Promise<void>
  onClear: () => void
}) {
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
      onFileSelect={(files) => void onFileSelect(files)}
      onClearFiles={onClear}
      acceptedTypes="video/*,.mkv"
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
                <div className="relative">
                  <video
                    src={file.preview}
                    className="w-full max-h-48 lg:max-h-48 rounded-lg bg-muted/20"
                    controls
                    preload="metadata"
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
  const [selectedFiles, setSelectedFiles] = useState<VideoFile[]>([])
  const [metadata, setMetadata] = useState<Record<string, VideoMetadata>>({})
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
  const getFfmpegProcessor = useCallback(async (): Promise<FFmpegProcessor> => {
    if (ffmpegProcessorRef.current) {
      return ffmpegProcessorRef.current
    }

    const core = isInitialized ? ffmpeg! : await init()
    if (!core) {
      throw new Error('Failed to initialize FFmpeg')
    }
    const proc = new FFmpegProcessor(core)
    ffmpegProcessorRef.current = proc
    return proc
  }, [isInitialized, ffmpeg, init])

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

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🎬 VideoTools: File selection started', {
        fileCount: files.length,
      })

      const file = files[0]
      if (file?.type.startsWith('video/') || file.name.endsWith('.mkv')) {
        console.log('🎬 VideoTools: Processing video file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const preview = URL.createObjectURL(file)

        const video = document.createElement('video')
        const videoMetadata = await new Promise<{
          width: number
          height: number
          duration: number
        }>((resolve) => {
          video.onloadedmetadata = () => {
            resolve({
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            })
          }
          video.src = preview
        })

        const videoFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type,
          dimensions: {
            width: videoMetadata.width,
            height: videoMetadata.height,
          },
          duration: videoMetadata.duration,
        }

        setSelectedFiles([videoFile])
        setMetadata({})

        if (!isInitialized) {
          console.log('🎬 VideoTools: Initializing FFmpeg...')
          await init()
          console.log('🎬 VideoTools: FFmpeg initialization completed')
        }

        // Extract metadata
        try {
          const processor = await getFfmpegProcessor()
          await processor.mountInputFile(videoFile)
          const meta = await processor.extractMetadata()
          setMetadata((prev) => ({ ...prev, [videoFile.name]: meta }))
        } catch (error) {
          console.error('🎬 VideoTools: Error extracting metadata:', error)
        }
      }
    },
    [isInitialized, init, getFfmpegProcessor],
  )

  const clearSelectedFile = useCallback(() => {
    setSelectedFiles([])
    setMetadata({})
    setProgress(0)
    setProgressStartTime(null)
    setEstimatedTimeRemaining(null)
    setElapsedTime(null)
    setShowSlowProcessingWarning(false)
    setCurrentAbortController(null)
  }, [])

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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="glass-card border-destructive">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <X className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">FFmpeg Initialization Error</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {typeof error === 'string' ? error : (error as Error).message}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <VideoToolsContext.Provider value={contextValue}>
      <ToolLayout
        title="Video Tools"
        icon={VideoIcon}
        iconColor="text-purple-500"
        iconBgColor="bg-gradient-to-br from-purple-500/10 to-purple-500/5"
        fileUploadComponent={
          <VideoFileUpload
            selectedFiles={selectedFiles}
            onFileSelect={handleFileSelect}
            onClear={clearSelectedFile}
          />
        }
        toolsComponent={
          <VideoTools
            currentTab={currentTab}
            onTabChange={handleTabChange}
            isProcessing={isProcessing}
          />
        }
      />
    </VideoToolsContext.Provider>
  )
}
