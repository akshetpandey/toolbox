import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'

import { Checkbox } from '@/components/ui/checkbox'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { downloadFile } from '@/lib/shared'
import type { TrimOptions } from '@/lib/ffmpeg'
import { AlertTriangle, X, Scissors, Pause, Square } from 'lucide-react'

export const Route = createFileRoute('/videos/trim')({
  component: VideoTrimComponent,
  head: () => ({
    meta: [
      {
        title:
          'Video Trimmer - Free Browser-Based Video Editing Tool | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based video trimming tool. Cut and trim videos, create GIFs, and export clips. Process videos entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'video trimmer, cut video, create GIF from video, video editor, browser video trimmer, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Video Trimmer - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based video trimming. Cut videos and create GIFs with complete privacy.',
      },
    ],
  }),
})

function VideoTrimComponent() {
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

  // Trim settings
  const [startTime, setStartTime] = useState('00:00:00')
  const [endTime, setEndTime] = useState('00:00:10')
  const [exportFormat, setExportFormat] = useState<'original' | 'gif' | 'webp'>(
    'original',
  )
  const [enableLoop, setEnableLoop] = useState<boolean>(false) // true for infinite loop

  const trimVideo = useCallback(async () => {
    if (!selectedFile) return

    console.log('🎬 VideoTools: Starting video trimming', {
      startTime,
      endTime,
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
      const options: TrimOptions = {
        startTime,
        endTime,
        format: exportFormat,
        loop:
          exportFormat === 'gif' || exportFormat === 'webp'
            ? enableLoop
            : undefined,
        signal: abortController.signal,
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

      let extension: string
      if (exportFormat === 'gif') {
        extension = 'gif'
      } else if (exportFormat === 'webp') {
        extension = 'webp'
      } else {
        extension = ffmpegProcessor.inputFile?.name.split('.').pop() ?? 'mp4'
      }

      const filename = `${originalName}_trimmed.${extension}`

      // Download the file directly
      downloadFile(URL.createObjectURL(blob), filename)

      setProgress(100)
      console.log('🎬 VideoTools: Trimming successful - file downloaded')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🎬 VideoTools: Trimming cancelled by user')
      } else {
        console.error('🎬 VideoTools: Error during trimming:', error)
        alert('Error trimming video. Please try again.')
      }
    } finally {
      setIsProcessing(false)
      setCurrentAbortController(null)
    }
  }, [
    selectedFile,
    startTime,
    endTime,
    exportFormat,
    enableLoop,
    getFfmpegProcessor,
    setCurrentAbortController,
    setIsProcessing,
    setProgress,
    setProgressStartTime,
    setEstimatedTimeRemaining,
    setElapsedTime,
    setShowSlowProcessingWarning,
  ])

  // Helper function to convert seconds to HH:MM:SS format
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Helper function to convert HH:MM:SS to seconds
  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number)
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    return 0
  }

  // Quick time preset buttons
  const setQuickTime = (start: number, duration: number) => {
    setStartTime(formatTime(start))
    setEndTime(formatTime(start + duration))
  }

  const videoDuration = selectedFile?.duration ?? 0
  const startSeconds = parseTime(startTime)
  const endSeconds = parseTime(endTime)
  const trimDuration = Math.max(0, endSeconds - startSeconds)

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
                Browser-based video processing is slow for large files. For
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
              <span className="text-sm font-medium">Trimming Video</span>
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
          {/* Video Info */}
          {videoDuration > 0 && (
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Video Information</h4>
              <div className="text-xs text-muted-foreground">
                <div>Original Duration: {formatTime(videoDuration)}</div>
                <div>Trim Duration: {formatTime(trimDuration)}</div>
                <div>
                  Start: {startTime} → End: {endTime}
                </div>
              </div>
            </div>
          )}

          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={exportFormat === 'original' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('original')}
                  disabled={isProcessing}
                >
                  Original Format
                </Button>
                <Button
                  variant={exportFormat === 'gif' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('gif')}
                  disabled={isProcessing}
                >
                  Animated GIF
                </Button>
                <Button
                  variant={exportFormat === 'webp' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExportFormat('webp')}
                  disabled={isProcessing}
                >
                  Animated WebP
                </Button>
              </div>
              {(exportFormat === 'gif' || exportFormat === 'webp') && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="enableLoop"
                    checked={enableLoop}
                    onCheckedChange={(checked) =>
                      setEnableLoop(checked === true)
                    }
                    disabled={isProcessing}
                  />
                  <Label htmlFor="enableLoop" className="text-sm font-medium">
                    Loop
                  </Label>
                </div>
              )}
            </div>
            {(exportFormat === 'gif' || exportFormat === 'webp') && (
              <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded p-2">
                <strong>Note:</strong> GIF and WebP exports will be video only
                (no audio)
                {enableLoop && ' and will loop continuously'}
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quick Presets</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickTime(0, 30)}
                disabled={isProcessing}
              >
                First 30s
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickTime(0, 60)}
                disabled={isProcessing}
              >
                First 1min
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuickTime(Math.max(0, videoDuration - 30), 30)
                }
                disabled={isProcessing || videoDuration <= 30}
              >
                Last 30s
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuickTime(Math.max(0, videoDuration - 60), 60)
                }
                disabled={isProcessing || videoDuration <= 60}
              >
                Last 1min
              </Button>
            </div>
          </div>

          {/* Time Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Time */}
            <div className="space-y-3">
              <Label htmlFor="startTime" className="text-sm font-medium">
                Start Time (HH:MM:SS)
              </Label>
              <Input
                id="startTime"
                type="text"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isProcessing}
                placeholder="00:00:00"
                pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              />
              <div className="text-xs text-muted-foreground">
                Format: Hours:Minutes:Seconds
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-3">
              <Label htmlFor="endTime" className="text-sm font-medium">
                End Time (HH:MM:SS)
              </Label>
              <Input
                id="endTime"
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isProcessing}
                placeholder="00:00:10"
                pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              />
              <div className="text-xs text-muted-foreground">
                Format: Hours:Minutes:Seconds
              </div>
            </div>
          </div>

          {/* Validation */}
          {(startSeconds >= endSeconds || endSeconds > videoDuration) &&
            videoDuration > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm text-red-800">
                  {startSeconds >= endSeconds &&
                    'End time must be after start time.'}
                  {endSeconds > videoDuration &&
                    'End time exceeds video duration.'}
                </div>
              </div>
            )}

          {/* Trim Button */}
          <Button
            onClick={() => void trimVideo()}
            disabled={
              isProcessing ||
              !selectedFile ||
              startSeconds >= endSeconds ||
              endSeconds > videoDuration
            }
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Trimming...
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4 mr-2" />
                Trim Video
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
