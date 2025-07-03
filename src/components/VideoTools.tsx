import { useState, useCallback, useRef, useEffect } from 'react'
import { useSearch, useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useInitFFmpeg } from '@/hooks/useInitFFmpeg'
import {
  FFmpegProcessor,
  type VideoFile,
  type VideoMetadata,
  type VideoConvertOptions,
  type VideoCompressOptions,
  type TrimOptions,
  type AudioExtractOptions,
  formatFileSize,
  formatDuration,
  downloadFile,
} from '@/lib/ffmpeg'

import {
  Upload,
  Video as VideoIcon,
  Info,
  FileVideo,
  Loader2,
  Settings,
  Zap,
  Scissors,
  Volume2,
} from 'lucide-react'

export function VideoTools() {
  const {
    ffmpeg,
    isInitialized,
    isInitializing,
    error,
    init,
    setProgressCallback,
  } = useInitFFmpeg()
  const search = useSearch({ from: '/videos' })
  const navigate = useNavigate()
  const [selectedFiles, setSelectedFiles] = useState<VideoFile[]>([])
  const [metadata, setMetadata] = useState<Record<string, VideoMetadata>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Set up progress callback
  useEffect(() => {
    setProgressCallback((progressValue) => {
      setProgress(progressValue)
    })
  }, [setProgressCallback])

  // Create FFmpeg processor instance - use useMemo to prevent recreation on every render
  const ffmpegProcessorRef = useRef<FFmpegProcessor | null>(null)
  const getFfmpegProcessor = useCallback(async (): Promise<FFmpegProcessor> => {
    if (ffmpegProcessorRef.current) {
      return ffmpegProcessorRef.current
    }

    // Initialize core if needed
    const core = isInitialized ? ffmpeg! : await init()
    if (!core) {
      throw new Error('Failed to initialize FFmpeg')
    }
    const proc = new FFmpegProcessor(core)
    ffmpegProcessorRef.current = proc
    return proc
  }, [isInitialized, ffmpeg, init])

  // Get the current active tab from URL search params
  const activeTab = search?.tab ?? 'metadata'

  // Handle tab changes
  const handleTabChange = async (value: string) => {
    await navigate({
      to: '/videos',
      search: { tab: value },
    })
  }

  // Convert settings
  const [targetFormat, setTargetFormat] = useState('mp4')
  const [videoCodec, setVideoCodec] = useState('libx264')
  const [audioCodec, setAudioCodec] = useState('aac')

  // Compress settings
  const [crf, setCrf] = useState(23)
  const [preset, setPreset] = useState('medium')

  // Trim settings
  const [startTime, setStartTime] = useState('00:00:00')
  const [endTime, setEndTime] = useState('00:00:10')

  // Extract audio settings
  const [audioFormat, setAudioFormat] = useState('mp3')

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      console.log('🎬 VideoTools: File selection started', {
        fileCount: files.length,
        files: files,
      })

      // Only take the first video file
      const file = files[0]
      if (file?.type.startsWith('video/') || file.name.endsWith('.mkv')) {
        console.log('🎬 VideoTools: Processing video file', {
          name: file.name,
          size: file.size,
          type: file.type,
        })

        const preview = URL.createObjectURL(file)

        // Get video dimensions and duration
        const video = document.createElement('video')
        const metadata = await new Promise<{
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

        console.log('🎬 VideoTools: Video metadata extracted', metadata)

        const videoFile = {
          file,
          preview,
          name: file.name,
          size: file.size,
          type: file.type,
          duration: metadata.duration,
          dimensions: { width: metadata.width, height: metadata.height },
        }

        setSelectedFiles([videoFile])
        setMetadata({})

        // Initialize FFmpeg if not already initialized
        if (!isInitialized) {
          console.log('🎬 VideoTools: Initializing FFmpeg...')
          await init()
          console.log('🎬 VideoTools: FFmpeg initialization completed')
        }

        // Mount the input file
        console.log('🎬 VideoTools: Mounting input file', {
          name: videoFile.name,
          size: videoFile.size,
          type: videoFile.type,
        })
        await mountInputFile(videoFile)

        // Parse the metadata
        console.log('🎬 VideoTools: Starting metadata parsing...')
        await parseMetadata()
        console.log('🎬 VideoTools: File selection completed successfully')
      } else {
        console.warn('🎬 VideoTools: Invalid file type selected. ', {
          type: file?.type,
        })
      }
    },
    [isInitialized, init],
  )

  const mountInputFile = useCallback(
    async (file: VideoFile) => {
      const ffmpegProcessor = await getFfmpegProcessor()
      await ffmpegProcessor.unmountInputFile()
      await ffmpegProcessor.mountInputFile(file)
    },
    [getFfmpegProcessor],
  )

  const parseMetadata = useCallback(async () => {
    console.log('🎬 VideoTools: Starting metadata parsing for')
    const ffmpegProcessor = await getFfmpegProcessor()
    // Extract metadata with the new processor
    try {
      const meta = await ffmpegProcessor.extractMetadata()
      console.log('🎬 VideoTools: Metadata parsing successful', meta)
      setMetadata((prev) => ({
        ...prev,
        [ffmpegProcessor.inputFile?.name ?? '']: meta,
      }))
    } catch (error) {
      console.error('🎬 VideoTools: Error extracting metadata:', error)
      // Fallback to basic metadata
      const meta: VideoMetadata = {
        format: {
          filename: ffmpegProcessor.inputFile?.name ?? 'Unknown',
          format_name:
            ffmpegProcessor.inputFile?.type.split('/')[1]?.toUpperCase() ??
            'Unknown',
          format_long_name: 'Unknown',
          duration: ffmpegProcessor.inputFile?.duration ?? 0,
          size: ffmpegProcessor.inputFile?.size ?? 0,
          bit_rate: 0,
          nb_streams: 0,
        },
        video_streams: [],
        audio_streams: [],
        subtitle_streams: [],
        duration: ffmpegProcessor.inputFile?.duration ?? 0,
        width: ffmpegProcessor.inputFile?.dimensions?.width ?? 0,
        height: ffmpegProcessor.inputFile?.dimensions?.height ?? 0,
        bitrate: 'Unknown',
        fps: 'Unknown',
        codec: 'Unknown',
      }
      console.log('🎬 VideoTools: Using fallback metadata', meta)
      setMetadata((prev) => ({
        ...prev,
        [ffmpegProcessor.inputFile?.name ?? '']: meta,
      }))
    }
  }, [getFfmpegProcessor])

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

  const convertVideo = async () => {
    console.log('🎬 VideoTools: Starting video conversion', {
      targetFormat,
      videoCodec,
      audioCodec,
      preset,
    })

    const ffmpegProcessor = await getFfmpegProcessor()

    setIsProcessing(true)
    setProgress(0)

    try {
      const options: VideoConvertOptions = {
        targetFormat,
        videoCodec,
        audioCodec,
        preset,
      }

      console.log('🎬 VideoTools: Calling FFmpeg convert with options', options)
      const blob = await ffmpegProcessor.convertVideo(options)
      console.log('🎬 VideoTools: Conversion completed', {
        originalSize: ffmpegProcessor.inputFile?.size,
        newSize: blob.size,
      })

      // Generate filename with original name and new format
      const originalName = ffmpegProcessor.inputFile?.name.replace(
        /\.[^/.]+$/,
        '',
      ) // Remove extension
      const filename = `${originalName}.${targetFormat}`

      // Download the file directly
      downloadFile(URL.createObjectURL(blob), filename)

      setProgress(100)
      console.log('🎬 VideoTools: Conversion successful - file downloaded')
    } catch (error) {
      console.error('🎬 VideoTools: Error during conversion:', error)
      alert('Error converting video. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const compressVideo = async () => {
    console.log('🎬 VideoTools: Starting video compression', {
      crf,
      preset,
    })

    const ffmpegProcessor = await getFfmpegProcessor()

    setIsProcessing(true)
    setProgress(0)

    try {
      const options: VideoCompressOptions = {
        crf,
        preset,
      }

      console.log(
        '🎬 VideoTools: Calling FFmpeg compress with options',
        options,
      )
      const blob = await ffmpegProcessor.compressVideo(options)
      console.log('🎬 VideoTools: Compression completed', {
        originalSize: ffmpegProcessor.inputFile?.size,
        newSize: blob.size,
        compressionRatio:
          (
            ((ffmpegProcessor.inputFile?.size ?? 0 - blob.size) /
              (ffmpegProcessor.inputFile?.size ?? 0)) *
            100
          ).toFixed(1) + '%',
      })

      // Generate filename with original name and compressed suffix
      const originalName = ffmpegProcessor.inputFile?.name.replace(
        /\.[^/.]+$/,
        '',
      ) // Remove extension
      const extension =
        ffmpegProcessor.inputFile?.name.split('.').pop() ?? 'mp4'
      const filename = `${originalName}_compressed.${extension}`

      // Download the file directly
      downloadFile(URL.createObjectURL(blob), filename)

      setProgress(100)
      console.log('🎬 VideoTools: Compression successful - file downloaded')
    } catch (error) {
      console.error('🎬 VideoTools: Error during compression:', error)
      alert('Error compressing video. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const trimVideo = async () => {
    console.log('🎬 VideoTools: Starting video trimming', {
      startTime,
      endTime,
    })

    const ffmpegProcessor = await getFfmpegProcessor()

    setIsProcessing(true)
    setProgress(0)

    try {
      const options: TrimOptions = {
        startTime,
        endTime,
      }

      console.log('🎬 VideoTools: Calling FFmpeg trim with options', options)
      const blob = await ffmpegProcessor.trimVideo(options)
      console.log('🎬 VideoTools: Trimming completed', {
        originalSize: ffmpegProcessor.inputFile?.size,
        newSize: blob.size,
      })

      // Generate filename with original name and trimmed suffix
      const originalName = ffmpegProcessor.inputFile?.name.replace(
        /\.[^/.]+$/,
        '',
      ) // Remove extension
      const extension =
        ffmpegProcessor.inputFile?.name.split('.').pop() ?? 'mp4'
      const filename = `${originalName}_trimmed.${extension}`

      // Download the file directly
      downloadFile(URL.createObjectURL(blob), filename)

      setProgress(100)
      console.log('🎬 VideoTools: Trimming successful - file downloaded')
    } catch (error) {
      console.error('🎬 VideoTools: Error during trimming:', error)
      alert('Error trimming video. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const extractAudio = async () => {
    console.log('🎬 VideoTools: Starting audio extraction', {
      audioFormat,
    })

    const ffmpegProcessor = await getFfmpegProcessor()

    setIsProcessing(true)
    setProgress(0)

    try {
      const options: AudioExtractOptions = {
        audioFormat,
      }

      console.log(
        '🎬 VideoTools: Calling FFmpeg extract audio with options',
        options,
      )
      const blob = await ffmpegProcessor.extractAudio(options)
      console.log('🎬 VideoTools: Audio extraction completed', {
        originalSize: ffmpegProcessor.inputFile?.size,
        newSize: blob.size,
      })

      // Generate filename with original name and audio format
      const originalName = ffmpegProcessor.inputFile?.name.replace(
        /\.[^/.]+$/,
        '',
      ) // Remove extension
      const filename = `${originalName}.${audioFormat}`

      // Download the file directly
      downloadFile(URL.createObjectURL(blob), filename)

      setProgress(100)
      console.log(
        '🎬 VideoTools: Audio extraction successful - file downloaded',
      )
    } catch (error) {
      console.error('🎬 VideoTools: Error during audio extraction:', error)
      alert('Error extracting audio. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background/80 z-50 fixed top-0 left-0">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <span className="text-lg text-foreground">
            Loading video tools...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background/80 z-50 fixed top-0 left-0">
        <div className="flex flex-col items-center gap-4">
          <span className="text-lg text-red-500">
            Failed to load video tools: {error}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="glass border-b border-border/50">
        <div className="container mx-auto px-8 py-4">
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
                        Drop a video here
                      </h3>
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
                            setSelectedFiles([])
                            setMetadata({})
                          }}
                          className="hover:bg-red-500 hover:text-red-foreground text-xs"
                        >
                          Clear
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {selectedFiles.map((file) => (
                          <div key={file.name} className="space-y-2">
                            <div className="relative">
                              <video
                                src={file.preview}
                                className="w-full max-h-64 object-contain rounded-lg bg-muted/20"
                                style={{
                                  minHeight:
                                    file.dimensions &&
                                    file.dimensions.height >
                                      file.dimensions.width
                                      ? '200px'
                                      : '120px',
                                }}
                                controls
                              />
                            </div>
                            <div className="space-y-1">
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
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => void handleTabChange(value)}
                  className="space-y-4"
                >
                  <TabsList className="flat-card border-0 grid w-full grid-cols-5 h-10">
                    <TabsTrigger
                      value="metadata"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Info className="w-4 h-4 mr-2" />
                      Metadata
                    </TabsTrigger>
                    <TabsTrigger
                      value="convert"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Convert
                    </TabsTrigger>
                    <TabsTrigger
                      value="compress"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Compress
                    </TabsTrigger>
                    <TabsTrigger
                      value="trim"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Scissors className="w-4 h-4 mr-2" />
                      Trim
                    </TabsTrigger>
                    <TabsTrigger
                      value="audio"
                      className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm"
                    >
                      <Volume2 className="w-4 h-4 mr-2" />
                      Audio
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="metadata">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6">
                        {selectedFiles.length > 0 &&
                        metadata[selectedFiles[0].name] ? (
                          <div className="space-y-6">
                            {/* Format Information */}
                            <div>
                              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                <Info className="h-5 w-5 text-blue-500" />
                                Format Information
                              </h3>
                              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Container:
                                    </span>
                                    <span className="font-medium">
                                      {
                                        metadata[selectedFiles[0].name].format
                                          .format_name
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Duration:
                                    </span>
                                    <span className="font-medium">
                                      {formatDuration(
                                        metadata[selectedFiles[0].name].format
                                          .duration,
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      File Size:
                                    </span>
                                    <span className="font-medium">
                                      {formatFileSize(
                                        metadata[selectedFiles[0].name].format
                                          .size,
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      Overall Bitrate:
                                    </span>
                                    <span className="font-medium">
                                      {metadata[selectedFiles[0].name].format
                                        .bit_rate > 0
                                        ? `${Math.round(metadata[selectedFiles[0].name].format.bit_rate / 1000)} kbps`
                                        : 'Unknown'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between col-span-2">
                                    <span className="text-muted-foreground">
                                      Streams:
                                    </span>
                                    <span className="font-medium">
                                      {
                                        metadata[selectedFiles[0].name].format
                                          .nb_streams
                                      }{' '}
                                      total
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Video Streams */}
                            {metadata[selectedFiles[0].name].video_streams
                              .length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                  <VideoIcon className="h-5 w-5 text-purple-500" />
                                  Video Streams (
                                  {
                                    metadata[selectedFiles[0].name]
                                      .video_streams.length
                                  }
                                  )
                                </h3>
                                <div className="space-y-3">
                                  {metadata[
                                    selectedFiles[0].name
                                  ].video_streams.map((stream) => (
                                    <div
                                      key={stream.index}
                                      className="bg-muted/50 p-4 rounded-lg"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          Stream #{stream.index}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {stream.codec_long_name}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Codec:
                                          </span>
                                          <span className="font-medium">
                                            {stream.codec_name.toUpperCase()}
                                            {stream.profile &&
                                              ` (${stream.profile})`}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Resolution:
                                          </span>
                                          <span className="font-medium">
                                            {stream.width} × {stream.height}
                                          </span>
                                        </div>
                                        {stream.display_aspect_ratio && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Aspect Ratio:
                                            </span>
                                            <span className="font-medium">
                                              {stream.display_aspect_ratio}
                                            </span>
                                          </div>
                                        )}
                                        {stream.fps && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Frame Rate:
                                            </span>
                                            <span className="font-medium">
                                              {stream.fps} fps
                                            </span>
                                          </div>
                                        )}
                                        {stream.pix_fmt && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Pixel Format:
                                            </span>
                                            <span className="font-medium">
                                              {stream.pix_fmt}
                                            </span>
                                          </div>
                                        )}
                                        {stream.color_space && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Color Space:
                                            </span>
                                            <span className="font-medium">
                                              {stream.color_space}
                                            </span>
                                          </div>
                                        )}
                                        {stream.color_range && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Color Range:
                                            </span>
                                            <span className="font-medium">
                                              {stream.color_range}
                                            </span>
                                          </div>
                                        )}
                                        {stream.color_transfer && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Transfer:
                                            </span>
                                            <span className="font-medium">
                                              {stream.color_transfer}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Audio Streams */}
                            {metadata[selectedFiles[0].name].audio_streams
                              .length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                  <Volume2 className="h-5 w-5 text-green-500" />
                                  Audio Streams (
                                  {
                                    metadata[selectedFiles[0].name]
                                      .audio_streams.length
                                  }
                                  )
                                </h3>
                                <div className="space-y-3">
                                  {metadata[
                                    selectedFiles[0].name
                                  ].audio_streams.map((stream) => (
                                    <div
                                      key={stream.index}
                                      className="bg-muted/50 p-4 rounded-lg"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            Stream #{stream.index}
                                          </Badge>
                                          {stream.is_default && (
                                            <Badge
                                              variant="default"
                                              className="text-xs"
                                            >
                                              Default
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {stream.codec_long_name}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Codec:
                                          </span>
                                          <span className="font-medium">
                                            {stream.codec_name.toUpperCase()}
                                            {stream.profile &&
                                              ` (${stream.profile})`}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Sample Rate:
                                          </span>
                                          <span className="font-medium">
                                            {stream.sample_rate} Hz
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Channels:
                                          </span>
                                          <span className="font-medium">
                                            {stream.channels}
                                            {stream.channel_layout &&
                                              ` (${stream.channel_layout})`}
                                          </span>
                                        </div>
                                        {stream.bit_rate && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Bitrate:
                                            </span>
                                            <span className="font-medium">
                                              {Math.round(
                                                stream.bit_rate / 1000,
                                              )}{' '}
                                              kbps
                                            </span>
                                          </div>
                                        )}
                                        {stream.language && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Language:
                                            </span>
                                            <span className="font-medium">
                                              {stream.language.toUpperCase()}
                                            </span>
                                          </div>
                                        )}
                                        {stream.title && (
                                          <div className="flex justify-between col-span-2">
                                            <span className="text-muted-foreground">
                                              Title:
                                            </span>
                                            <span className="font-medium">
                                              {stream.title}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Subtitle Streams */}
                            {metadata[selectedFiles[0].name].subtitle_streams
                              .length > 0 && (
                              <div>
                                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                                  <FileVideo className="h-5 w-5 text-orange-500" />
                                  Subtitle Streams (
                                  {
                                    metadata[selectedFiles[0].name]
                                      .subtitle_streams.length
                                  }
                                  )
                                </h3>
                                <div className="space-y-3">
                                  {metadata[
                                    selectedFiles[0].name
                                  ].subtitle_streams.map((stream) => (
                                    <div
                                      key={stream.index}
                                      className="bg-muted/50 p-4 rounded-lg"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            Stream #{stream.index}
                                          </Badge>
                                          {stream.is_default && (
                                            <Badge
                                              variant="default"
                                              className="text-xs"
                                            >
                                              Default
                                            </Badge>
                                          )}
                                          {stream.is_forced && (
                                            <Badge
                                              variant="destructive"
                                              className="text-xs"
                                            >
                                              Forced
                                            </Badge>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {stream.codec_long_name}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">
                                            Format:
                                          </span>
                                          <span className="font-medium">
                                            {stream.codec_name.toUpperCase()}
                                          </span>
                                        </div>
                                        {stream.language && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                              Language:
                                            </span>
                                            <span className="font-medium">
                                              {stream.language.toUpperCase()}
                                            </span>
                                          </div>
                                        )}
                                        {stream.title && (
                                          <div className="flex justify-between col-span-2">
                                            <span className="text-muted-foreground">
                                              Title:
                                            </span>
                                            <span className="font-medium">
                                              {stream.title}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32">
                            <div className="text-center text-muted-foreground">
                              <VideoIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">
                                Select a video to view metadata
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="convert">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="format"
                              className="text-sm font-medium"
                            >
                              Target Format
                            </Label>
                            <Select
                              value={targetFormat}
                              onValueChange={setTargetFormat}
                            >
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mp4">MP4</SelectItem>
                                <SelectItem value="webm">WebM</SelectItem>
                                <SelectItem value="avi">AVI</SelectItem>
                                <SelectItem value="mov">MOV</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="videoCodec"
                              className="text-sm font-medium"
                            >
                              Video Codec
                            </Label>
                            <Select
                              value={videoCodec}
                              onValueChange={setVideoCodec}
                            >
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="libx264">H.264</SelectItem>
                                <SelectItem value="libx265">H.265</SelectItem>
                                <SelectItem value="libvpx-vp9">VP9</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="audioCodec"
                              className="text-sm font-medium"
                            >
                              Audio Codec
                            </Label>
                            <Select
                              value={audioCodec}
                              onValueChange={setAudioCodec}
                            >
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="aac">AAC</SelectItem>
                                <SelectItem value="mp3">MP3</SelectItem>
                                <SelectItem value="libopus">Opus</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="preset"
                              className="text-sm font-medium"
                            >
                              Preset
                            </Label>
                            <Select value={preset} onValueChange={setPreset}>
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ultrafast">
                                  Ultrafast
                                </SelectItem>
                                <SelectItem value="superfast">
                                  Superfast
                                </SelectItem>
                                <SelectItem value="veryfast">
                                  Veryfast
                                </SelectItem>
                                <SelectItem value="faster">Faster</SelectItem>
                                <SelectItem value="fast">Fast</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="slow">Slow</SelectItem>
                                <SelectItem value="slower">Slower</SelectItem>
                                <SelectItem value="veryslow">
                                  Veryslow
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Processing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => void convertVideo()}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            Convert Video
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="compress">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="crf"
                              className="text-sm font-medium"
                            >
                              CRF Value (18-28)
                            </Label>
                            <Input
                              id="crf"
                              type="number"
                              min="18"
                              max="28"
                              value={crf}
                              onChange={(e) => setCrf(parseInt(e.target.value))}
                              className="border-border/50"
                            />
                            <p className="text-xs text-muted-foreground">
                              Lower = higher quality, larger file
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="preset"
                              className="text-sm font-medium"
                            >
                              Preset
                            </Label>
                            <Select value={preset} onValueChange={setPreset}>
                              <SelectTrigger className="border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ultrafast">
                                  Ultrafast
                                </SelectItem>
                                <SelectItem value="superfast">
                                  Superfast
                                </SelectItem>
                                <SelectItem value="veryfast">
                                  Veryfast
                                </SelectItem>
                                <SelectItem value="faster">Faster</SelectItem>
                                <SelectItem value="fast">Fast</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="slow">Slow</SelectItem>
                                <SelectItem value="slower">Slower</SelectItem>
                                <SelectItem value="veryslow">
                                  Veryslow
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Processing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => void compressVideo()}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            Compress Video
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="trim">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label
                              htmlFor="startTime"
                              className="text-sm font-medium"
                            >
                              Start Time (HH:MM:SS)
                            </Label>
                            <Input
                              id="startTime"
                              value={startTime}
                              onChange={(e) => setStartTime(e.target.value)}
                              placeholder="00:00:00"
                              className="border-border/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label
                              htmlFor="endTime"
                              className="text-sm font-medium"
                            >
                              End Time (HH:MM:SS)
                            </Label>
                            <Input
                              id="endTime"
                              value={endTime}
                              onChange={(e) => setEndTime(e.target.value)}
                              placeholder="00:00:10"
                              className="border-border/50"
                            />
                          </div>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Processing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => void trimVideo()}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Scissors className="h-4 w-4 mr-2" />
                            )}
                            Trim Video
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="audio">
                    <Card className="glass-card border-0">
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                          <Label
                            htmlFor="audioFormat"
                            className="text-sm font-medium"
                          >
                            Audio Format
                          </Label>
                          <Select
                            value={audioFormat}
                            onValueChange={setAudioFormat}
                          >
                            <SelectTrigger className="border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mp3">MP3</SelectItem>
                              <SelectItem value="wav">WAV</SelectItem>
                              <SelectItem value="aac">AAC</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {progress > 0 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Processing...</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full h-2" />
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={() => void extractAudio()}
                            disabled={
                              isProcessing || selectedFiles.length === 0
                            }
                            className="bg-purple-500 hover:bg-purple-600"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Volume2 className="h-4 w-4 mr-2" />
                            )}
                            Extract Audio
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
