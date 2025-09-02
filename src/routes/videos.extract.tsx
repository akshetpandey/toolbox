import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { downloadFile } from '@/lib/shared'
import type { AudioExtractOptions } from '@/lib/ffmpeg'
import {
  AlertTriangle,
  X,
  Volume2,
  Pause,
  Square,
  Music,
  Headphones,
  Mic,
} from 'lucide-react'

export const Route = createFileRoute('/videos/extract')({
  component: VideoExtractComponent,
  head: () => ({
    meta: [
      {
        title:
          'Audio Extractor - Free Browser-Based Audio Extraction | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based audio extraction tool. Extract audio from videos in MP3, WAV, AAC, or FLAC formats. Process videos entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'extract audio from video, video to MP3, audio extraction, browser audio converter, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Audio Extractor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based audio extraction. Extract audio from videos in multiple formats.',
      },
    ],
  }),
})

function VideoExtractComponent() {
  const {
    selectedFile,
    isProcessing,
    progress,
    estimatedTimeRemaining,
    elapsedTime,
    showSlowProcessingWarning,
    setIsProcessing,
    setProgress,
    setProgressStartTime,
    setEstimatedTimeRemaining,
    setElapsedTime,
    setShowSlowProcessingWarning,
    setCurrentAbortController,
    getFfmpegProcessor,
    cancelProcessing,
  } = useVideoTools()

  // Extract audio settings
  const [audioFormat, setAudioFormat] = useState('mp3')

  const extractAudio = useCallback(async () => {
    if (!selectedFile) return

    console.log('🎬 VideoTools: Starting audio extraction', {
      audioFormat,
    })

    const ffmpegProcessor = await getFfmpegProcessor()
    const abortController = new AbortController()
    setCurrentAbortController(abortController)

    setIsProcessing(true)
    setProgress(0)
    setProgressStartTime(Date.now())
    setEstimatedTimeRemaining(null)
    setElapsedTime(null)
    setShowSlowProcessingWarning(false)

    try {
      const options: AudioExtractOptions = {
        audioFormat,
        signal: abortController.signal,
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🎬 VideoTools: Audio extraction cancelled by user')
      } else {
        console.error('🎬 VideoTools: Error during audio extraction:', error)
        alert('Error extracting audio. Please try again.')
      }
    } finally {
      setIsProcessing(false)
      setCurrentAbortController(null)
    }
  }, [
    selectedFile,
    audioFormat,
    getFfmpegProcessor,
    setCurrentAbortController,
    setIsProcessing,
    setProgress,
    setProgressStartTime,
    setEstimatedTimeRemaining,
    setElapsedTime,
    setShowSlowProcessingWarning,
  ])

  const audioFormatOptions = [
    {
      value: 'mp3',
      icon: Music,
      label: 'MP3',
      description: 'Universal compatibility',
    },
    {
      value: 'wav',
      icon: Headphones,
      label: 'WAV',
      description: 'Uncompressed, high quality',
    },
    {
      value: 'aac',
      icon: Volume2,
      label: 'AAC',
      description: 'High quality, small size',
    },
    {
      value: 'flac',
      icon: Mic,
      label: 'FLAC',
      description: 'Lossless compression',
    },
  ]

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6 flex flex-col gap-4">
        {/* Slow Processing Warning Banner */}
        {showSlowProcessingWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-800 mb-1">
                This will take a while...
              </h4>
              <p className="text-sm text-yellow-700 mb-3">
                Browser-based audio extraction is slow for large files. For
                better performance, consider using <strong>FFmpeg</strong>{' '}
                directly.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSlowProcessingWarning(false)}
              className="text-yellow-600 hover:text-yellow-800 p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Extracting Audio</span>
              <span className="text-sm text-muted-foreground">
                {progress.toFixed(1)}%
              </span>
            </div>
            <Progress value={progress} className="mb-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{elapsedTime && `Elapsed: ${elapsedTime}`}</span>
              <span>
                {estimatedTimeRemaining &&
                  `Remaining: ${estimatedTimeRemaining}`}
              </span>
            </div>
            <div className="flex justify-center mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelProcessing}
                className="text-red-600 hover:text-red-700"
              >
                <Square className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {/* Audio Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Audio Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {audioFormatOptions.map((option) => {
                const Icon = option.icon
                const isActive = audioFormat === option.value
                const isDisabled = isProcessing

                return (
                  <button
                    key={option.value}
                    onClick={() => !isDisabled && setAudioFormat(option.value)}
                    disabled={isDisabled}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all duration-200 text-left
                      ${
                        isActive
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/50 hover:border-border'
                      }
                      ${
                        isDisabled
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-muted/30'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-medium text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}
                        >
                          {option.label}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Audio Info */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Audio Extraction Info</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>• MP3: Universal compatibility, good compression</div>
              <div>• WAV: Uncompressed, largest file size</div>
              <div>• AAC: High quality with smaller file size</div>
              <div>• FLAC: Lossless compression for audiophiles</div>
            </div>
          </div>

          {/* Extract Button */}
          <Button
            onClick={() => void extractAudio()}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Extracting...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Extract Audio
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
