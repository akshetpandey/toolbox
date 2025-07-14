import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { VideoConvertOptions } from '@/lib/ffmpeg'
import {
  formatOptions,
  videoCodecOptions,
  audioCodecOptions,
  getCompatibleCodecs,
  isCodecCompatible,
  FormatRadioGroup,
  CodecRadioGroup,
  getCommonResolutions,
  getCompatibleResolutions,
} from '@/lib/videoToolsUtils'
import { AlertTriangle, X, Play, Pause, Square, Monitor } from 'lucide-react'

export const Route = createFileRoute('/videos/convert')({
  component: VideoConvertComponent,
})

function VideoConvertComponent() {
  const {
    selectedFile,
    metadata,
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

  // Convert settings
  const [targetFormat, setTargetFormat] = useState('mp4')
  const [videoCodec, setVideoCodec] = useState('libx264')
  const [audioCodec, setAudioCodec] = useState('aac')
  const [preset, setPreset] = useState('ultrafast')

  // Resolution settings
  const [selectedResolution, setSelectedResolution] = useState('original')
  const [customWidth, setCustomWidth] = useState('')
  const [customHeight, setCustomHeight] = useState('')
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)

  // Reset resolution selection if current selection becomes incompatible with new video
  useEffect(() => {
    if (
      selectedFile?.dimensions &&
      selectedResolution !== 'original' &&
      selectedResolution !== 'custom'
    ) {
      const compatibleResolutions = getCompatibleResolutions(
        selectedFile.dimensions.width,
        selectedFile.dimensions.height,
      )
      const isCurrentResolutionCompatible = compatibleResolutions.some(
        (res) => res.value === selectedResolution,
      )

      if (!isCurrentResolutionCompatible) {
        setSelectedResolution('original')
      }
    }
  }, [selectedFile, selectedResolution])

  // Handle format change and auto-select compatible codecs
  const handleFormatChange = useCallback(
    (newFormat: string) => {
      setTargetFormat(newFormat)

      // Auto-select compatible codecs if current ones are not compatible
      const compatibleVideoCodecs = getCompatibleCodecs(newFormat, 'video')
      const compatibleAudioCodecs = getCompatibleCodecs(newFormat, 'audio')

      if (
        !isCodecCompatible(newFormat, videoCodec, 'video') &&
        compatibleVideoCodecs.length > 0
      ) {
        setVideoCodec(compatibleVideoCodecs[0])
      }

      if (
        !isCodecCompatible(newFormat, audioCodec, 'audio') &&
        compatibleAudioCodecs.length > 0
      ) {
        setAudioCodec(compatibleAudioCodecs[0])
      }
    },
    [videoCodec, audioCodec],
  )

  const convertVideo = useCallback(async () => {
    if (!selectedFile) return

    console.log('🎬 VideoTools: Starting video conversion', {
      targetFormat,
      videoCodec,
      audioCodec,
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
      const options: VideoConvertOptions = {
        targetFormat,
        videoCodec,
        audioCodec,
        preset,
        downscale:
          selectedResolution !== 'original'
            ? {
                enabled: true,
                resolution:
                  selectedResolution !== 'custom'
                    ? selectedResolution
                    : undefined,
                customWidth:
                  selectedResolution === 'custom' && customWidth
                    ? parseInt(customWidth)
                    : undefined,
                customHeight:
                  selectedResolution === 'custom' && customHeight
                    ? parseInt(customHeight)
                    : undefined,
                maintainAspectRatio,
              }
            : undefined,
        signal: abortController.signal,
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🎬 VideoTools: Conversion cancelled by user')
      } else {
        console.error('🎬 VideoTools: Error during conversion:', error)
        alert('Error converting video. Please try again.')
      }
    } finally {
      setIsProcessing(false)
      setCurrentAbortController(null)
    }
  }, [
    selectedFile,
    targetFormat,
    videoCodec,
    audioCodec,
    preset,
    selectedResolution,
    customWidth,
    customHeight,
    maintainAspectRatio,
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
                a free, native video conversion tool.
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
              <span className="text-sm font-medium">Converting Video</span>
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
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Target Format</Label>
            <FormatRadioGroup
              options={formatOptions}
              value={targetFormat}
              onChange={handleFormatChange}
              disabled={isProcessing}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Video Codec Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Video Codec</Label>
                {selectedFile && metadata[selectedFile.name] && (
                  <div className="text-xs text-muted-foreground">
                    Current:{' '}
                    {metadata[
                      selectedFile.name
                    ].video_streams[0]?.codec_name.toUpperCase() || 'Unknown'}
                  </div>
                )}
              </div>
              <CodecRadioGroup
                options={videoCodecOptions}
                value={videoCodec}
                onChange={setVideoCodec}
                disabled={isProcessing}
                disabledOptions={videoCodecOptions
                  .filter(
                    (codec) =>
                      !isCodecCompatible(targetFormat, codec.value, 'video'),
                  )
                  .map((codec) => codec.value)}
              />
            </div>

            {/* Audio Codec Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Audio Codec</Label>
                {selectedFile && metadata[selectedFile.name] && (
                  <div className="text-xs text-muted-foreground">
                    Current:{' '}
                    {metadata[
                      selectedFile.name
                    ].audio_streams[0]?.codec_name.toUpperCase() || 'Unknown'}
                  </div>
                )}
              </div>
              <CodecRadioGroup
                options={audioCodecOptions}
                value={audioCodec}
                onChange={setAudioCodec}
                disabled={isProcessing}
                disabledOptions={audioCodecOptions
                  .filter(
                    (codec) =>
                      !isCodecCompatible(targetFormat, codec.value, 'audio'),
                  )
                  .map((codec) => codec.value)}
              />
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">
                <Monitor className="inline h-4 w-4 mr-1" />
                Output Resolution
              </Label>
              {selectedFile?.dimensions && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Current: {selectedFile.dimensions.width}×
                    {selectedFile.dimensions.height}
                    {(() => {
                      const aspectRatio =
                        selectedFile.dimensions.width /
                        selectedFile.dimensions.height
                      if (Math.abs(aspectRatio - 16 / 9) <= 0.1)
                        return ' (16:9)'
                      if (Math.abs(aspectRatio - 4 / 3) <= 0.1) return ' (4:3)'
                      if (Math.abs(aspectRatio - 1) <= 0.1) return ' (1:1)'
                      return ` (${aspectRatio.toFixed(2)}:1)`
                    })()}
                  </span>
                  <span className="text-green-600">
                    • Showing same aspect ratio, smaller/equal size only
                  </span>
                </div>
              )}
            </div>

            <Select
              value={selectedResolution}
              disabled={isProcessing}
              onValueChange={setSelectedResolution}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">
                  Keep original resolution
                </SelectItem>
                {(() => {
                  const resolutions = selectedFile?.dimensions
                    ? getCompatibleResolutions(
                        selectedFile.dimensions.width,
                        selectedFile.dimensions.height,
                      )
                    : getCommonResolutions()
                  return resolutions.map((resolution) => (
                    <SelectItem key={resolution.value} value={resolution.value}>
                      {resolution.label} - {resolution.description}
                    </SelectItem>
                  ))
                })()}
                <SelectItem value="custom">Custom resolution</SelectItem>
              </SelectContent>
            </Select>

            {selectedResolution === 'custom' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Custom Resolution:
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    placeholder="Width"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    className="w-24"
                    min="1"
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-muted-foreground">×</span>
                  <Input
                    type="number"
                    placeholder="Height"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    className="w-24"
                    min="1"
                    disabled={isProcessing}
                  />
                </div>
              </div>
            )}

            {selectedResolution !== 'original' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maintainAspectRatio"
                  checked={maintainAspectRatio}
                  onCheckedChange={(checked) =>
                    setMaintainAspectRatio(!!checked)
                  }
                  disabled={isProcessing}
                />
                <Label
                  htmlFor="maintainAspectRatio"
                  className="text-sm font-medium"
                >
                  Maintain aspect ratio
                </Label>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            {/* Preset Selection */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="preset" className="text-sm font-medium">
                Encoding Preset
              </Label>
              <Select
                value={preset}
                disabled={isProcessing}
                onValueChange={setPreset}
              >
                <SelectTrigger className="border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ultrafast">
                    Ultrafast - Fastest encoding, largest file
                  </SelectItem>
                  <SelectItem value="superfast">
                    Superfast - Very fast encoding
                  </SelectItem>
                  <SelectItem value="veryfast">
                    Veryfast - Fast encoding
                  </SelectItem>
                  <SelectItem value="faster">
                    Faster - Balanced speed/quality
                  </SelectItem>
                  <SelectItem value="fast">Fast - Good balance</SelectItem>
                  <SelectItem value="medium">
                    Medium - Default (slower but smaller)
                  </SelectItem>
                  <SelectItem value="slow">
                    Slow - Better quality, smaller file
                  </SelectItem>
                  <SelectItem value="slower">
                    Slower - High quality, very small file
                  </SelectItem>
                  <SelectItem value="veryslow">
                    Very Slow - Highest quality, smallest file
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Convert Button */}
          <Button
            onClick={() => void convertVideo()}
            disabled={isProcessing || !selectedFile}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Converting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Convert Video
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
