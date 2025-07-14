import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { downloadFile } from '@/lib/shared'
import type { VideoCompressOptions } from '@/lib/ffmpeg'
import { AlertTriangle, X, Zap, Pause, Square } from 'lucide-react'

export const Route = createFileRoute('/videos/compress')({
  component: VideoCompressComponent,
})

function VideoCompressComponent() {
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

  // Compress settings
  const [crf, setCrf] = useState(28)
  const [preset, setPreset] = useState('ultrafast')

  const compressVideo = useCallback(async () => {
    if (!selectedFile) return

    console.log('🎬 VideoTools: Starting video compression', {
      crf,
      preset,
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
      const options: VideoCompressOptions = {
        crf,
        preset,
        signal: abortController.signal,
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🎬 VideoTools: Compression cancelled by user')
      } else {
        console.error('🎬 VideoTools: Error during compression:', error)
        alert('Error compressing video. Please try again.')
      }
    } finally {
      setIsProcessing(false)
      setCurrentAbortController(null)
    }
  }, [
    selectedFile,
    crf,
    preset,
    getFfmpegProcessor,
    setCurrentAbortController,
    setIsProcessing,
    setProgress,
    setProgressStartTime,
    setEstimatedTimeRemaining,
    setElapsedTime,
    setShowSlowProcessingWarning,
  ])

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
                better performance, consider using <strong>HandBrake</strong> -
                a free, native video compression tool.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://handbrake.fr/', '_blank')}
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                >
                  Download HandBrake
                </Button>
              </div>
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
              <span className="text-sm font-medium">Compressing Video</span>
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
          {/* Quality Settings */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Quality (CRF)</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="0"
                  max="51"
                  value={crf}
                  onChange={(e) => setCrf(Number(e.target.value))}
                  disabled={isProcessing}
                  className="flex-1"
                />
                <div className="w-16">
                  <Input
                    type="number"
                    min="0"
                    max="51"
                    value={crf}
                    onChange={(e) => setCrf(Number(e.target.value))}
                    disabled={isProcessing}
                    className="text-center"
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Lower values = better quality, larger file size (0-51, default:
                23)
              </div>
            </div>
          </div>

          {/* Preset Selection */}
          <div className="space-y-3">
            <Label htmlFor="preset" className="text-sm font-medium">
              Encoding Preset
            </Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ultrafast">Ultrafast</SelectItem>
                <SelectItem value="superfast">Superfast</SelectItem>
                <SelectItem value="veryfast">Veryfast</SelectItem>
                <SelectItem value="faster">Faster</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="slow">Slow</SelectItem>
                <SelectItem value="slower">Slower</SelectItem>
                <SelectItem value="veryslow">Very Slow</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Faster presets = quicker encoding but larger files
            </div>
          </div>

          {/* Quality Guide */}
          <div className="bg-muted/30 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-2">Quality Guide</h4>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>• CRF 18-22: Very high quality (visually lossless)</div>
              <div>• CRF 23-28: High quality (recommended)</div>
              <div>• CRF 29-35: Medium quality (noticeable quality loss)</div>
              <div>• CRF 36+: Low quality (significant quality loss)</div>
            </div>
          </div>

          {/* Compress Button */}
          <Button
            onClick={() => void compressVideo()}
            disabled={isProcessing || !selectedFile}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Compressing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Compress Video
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
