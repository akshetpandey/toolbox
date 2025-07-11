import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Loader2,
  Settings,
  Zap,
  Scissors,
  Volume2,
  X,
  Video as VideoIcon,
} from 'lucide-react'

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

function VideoToolsLayout() {
  const {
    ffmpeg,
    isInitialized,
    isInitializing,
    error,
    init,
    setProgressCallback,
  } = useInitFFmpeg()
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      <div className="flex flex-col h-full bg-background">
        {/* Loading overlay */}
        {isInitializing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Initializing FFmpeg...</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="glass border-b border-border/50">
          <div className="container mx-auto p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg flex items-center justify-center">
                  <VideoIcon className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <h1 className="text-heading text-foreground">Video Tools</h1>
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
                          Drop a video here
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Supports MP4, WebM, AVI, MOV, MKV
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            MP4
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            WebM
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            AVI
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            MOV
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            MKV
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-primary/20 rounded-xl p-4 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                        onDrop={(e) => void handleDrop(e)}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                              <FileVideo className="h-3 w-3 text-primary" />
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              Selected Video
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
                                <video
                                  src={file.preview}
                                  className="w-full max-h-48 rounded-lg bg-muted/20"
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
                                      {file.dimensions.width} ×{' '}
                                      {file.dimensions.height}
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

                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Upload className="w-3 h-3" />
                            <span>Click to change video</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*,.mkv"
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
                          value="trim"
                          disabled={isProcessing}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Scissors className="w-4 h-4" />
                          Trim
                        </TabsTrigger>
                        <TabsTrigger
                          value="extract"
                          disabled={isProcessing}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                          Extract
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
    </VideoToolsContext.Provider>
  )
}
