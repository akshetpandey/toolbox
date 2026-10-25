import { Play, Globe, Archive, Monitor, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { useToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { downloadBlob } from '@/lib/shared'
import type { FFmpegProcessor } from '@/lib/ffmpeg'

// Format and codec compatibility definitions
export const formatOptions = [
  {
    value: 'mp4',
    icon: Play,
    label: 'MP4',
    description: 'Universal compatibility',
  },
  { value: 'webm', icon: Globe, label: 'WebM', description: 'Web optimized' },
  {
    value: 'mkv',
    icon: Archive,
    label: 'MKV',
    description: 'Flexible container',
  },
  { value: 'avi', icon: Monitor, label: 'AVI', description: 'Legacy format' },
] as const

export const videoCodecOptions = [
  { value: 'libx264', label: 'H.264', description: 'Best compatibility' },
  { value: 'libx265', label: 'H.265', description: 'Higher compression' },
  { value: 'libvpx', label: 'VP8', description: 'Web standard' },
] as const

export const audioCodecOptions = [
  { value: 'aac', label: 'AAC', description: 'High quality' },
  { value: 'mp3', label: 'MP3', description: 'Universal' },
  { value: 'libopus', label: 'Opus', description: 'Low latency' },
] as const

// Compatibility matrix
export const compatibilityMatrix: Record<
  string,
  { video: string[]; audio: string[] }
> = {
  mp4: {
    video: ['libx264', 'libx265'],
    audio: ['aac', 'mp3'],
  },
  webm: {
    video: ['libvpx'],
    audio: ['libopus'],
  },
  mkv: {
    video: ['libx264', 'libx265', 'libvpx'],
    audio: ['aac', 'mp3', 'libopus'],
  },
  avi: {
    video: ['libx264', 'libx265'],
    audio: ['aac', 'mp3'],
  },
  mov: {
    video: ['libx264', 'libx265'],
    audio: ['aac', 'mp3'],
  },
}

// Helper functions
export const getCompatibleCodecs = (
  format: string,
  type: 'video' | 'audio',
): string[] => {
  return compatibilityMatrix[format]?.[type] ?? []
}

export const isCodecCompatible = (
  format: string,
  codec: string,
  type: 'video' | 'audio',
): boolean => {
  const compatibleCodecs = getCompatibleCodecs(format, type)
  return compatibleCodecs.includes(codec)
}

// Common resolution presets for both orientations
export const getCommonResolutions = () => {
  return [
    // Widescreen (16:9) - Horizontal
    { value: '3840x2160', label: '4K (3840×2160)', description: 'Ultra HD' },
    { value: '2560x1440', label: '1440p (2560×1440)', description: 'QHD' },
    { value: '1920x1080', label: '1080p (1920×1080)', description: 'Full HD' },
    { value: '1280x720', label: '720p (1280×720)', description: 'HD' },
    { value: '854x480', label: '480p (854×480)', description: 'SD' },
    { value: '640x360', label: '360p (640×360)', description: 'Low' },

    // Widescreen (16:9) - Vertical
    {
      value: '2160x3840',
      label: '4K Vertical (2160×3840)',
      description: 'Ultra HD Portrait',
    },
    {
      value: '1440x2560',
      label: '1440p Vertical (1440×2560)',
      description: 'QHD Portrait',
    },
    {
      value: '1080x1920',
      label: '1080p Vertical (1080×1920)',
      description: 'Full HD Portrait',
    },
    {
      value: '720x1280',
      label: '720p Vertical (720×1280)',
      description: 'HD Portrait',
    },
    {
      value: '480x854',
      label: '480p Vertical (480×854)',
      description: 'SD Portrait',
    },
    {
      value: '360x640',
      label: '360p Vertical (360×640)',
      description: 'Low Portrait',
    },

    // Standard (4:3) - Horizontal
    { value: '1440x1080', label: '1440×1080', description: '4:3 HD' },
    { value: '1024x768', label: '1024×768', description: '4:3 Standard' },
    { value: '800x600', label: '800×600', description: '4:3 Low' },
    { value: '640x480', label: '640×480', description: '4:3 Basic' },

    // Standard (4:3) - Vertical
    { value: '1080x1440', label: '1080×1440', description: '4:3 HD Portrait' },
    {
      value: '768x1024',
      label: '768×1024',
      description: '4:3 Standard Portrait',
    },
    { value: '600x800', label: '600×800', description: '4:3 Low Portrait' },
    { value: '480x640', label: '480×640', description: '4:3 Basic Portrait' },

    // Square
    { value: '1080x1080', label: '1080×1080', description: 'Square HD' },
    { value: '720x720', label: '720×720', description: 'Square Standard' },
    { value: '480x480', label: '480×480', description: 'Square Low' },
  ]
}

export const calculateAspectRatio = (width: number, height: number): number => {
  return width / height
}

export const isAspectRatioCompatible = (
  videoAspectRatio: number,
  resolutionAspectRatio: number,
  tolerance = 0.1,
): boolean => {
  return Math.abs(videoAspectRatio - resolutionAspectRatio) <= tolerance
}

export const getCompatibleResolutions = (
  videoWidth: number,
  videoHeight: number,
) => {
  const videoAspectRatio = calculateAspectRatio(videoWidth, videoHeight)
  const allResolutions = getCommonResolutions()

  return allResolutions.filter((resolution) => {
    const [width, height] = resolution.value.split('x').map(Number)
    const resolutionAspectRatio = calculateAspectRatio(width, height)

    // Check aspect ratio compatibility
    const aspectRatioMatches = isAspectRatioCompatible(
      videoAspectRatio,
      resolutionAspectRatio,
    )

    // Check that resolution is not larger than source video
    const isNotLarger = width <= videoWidth && height <= videoHeight

    return aspectRatioMatches && isNotLarger
  })
}

// Radio Group Components
interface RadioGroupProps<T extends string> {
  options: readonly {
    value: T
    icon?: React.ComponentType<{ className?: string }>
    label: string
    description: string
  }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  disabledOptions?: T[]
}

export function FormatRadioGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  disabledOptions = [],
}: RadioGroupProps<T>) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon
          const isActive = value === option.value
          const isDisabled = disabled || disabledOptions.includes(option.value)

          return (
            <button
              key={option.value}
              onClick={() => !isDisabled && onChange(option.value)}
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
                {Icon && (
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                )}
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
  )
}

export function CodecRadioGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  disabledOptions = [],
}: RadioGroupProps<T>) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => {
          const isActive = value === option.value
          const isDisabled = disabled || disabledOptions.includes(option.value)

          return (
            <button
              key={option.value}
              onClick={() => !isDisabled && onChange(option.value)}
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
                    ? 'opacity-50 cursor-not-allowed bg-muted/20'
                    : 'cursor-pointer hover:bg-muted/30'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className={`font-medium text-sm ${isActive && !isDisabled ? 'text-primary' : isDisabled ? 'text-muted-foreground' : 'text-foreground'}`}
                  >
                    {option.label}
                    {isDisabled && (
                      <span className="ml-2 text-xs">(Not supported)</span>
                    )}
                  </div>
                  <div
                    className={`text-xs ${isDisabled ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
                  >
                    {option.description}
                  </div>
                </div>
                {isActive && !isDisabled && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Keep settings across navigation, resetting them when the source changes. */
export function useVideoSettings<T>(
  key: string,
  initial: T,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const source = useVideoTools().selectedFile?.file
  const [state, setState] = useWorkspaceState(key, { source, value: initial })
  useEffect(() => {
    if (state.source !== source) setState({ source, value: initial })
  }, [source, state.source, initial, setState])
  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      setState((previous) => ({
        source,
        value:
          typeof next === 'function'
            ? (next as (previous: T) => T)(
                previous.source === source ? previous.value : initial,
              )
            : next,
      }))
    },
    [source, initial, setState],
  )
  return [state.source === source ? state.value : initial, update]
}

/** Shared completion/error behavior for video actions; importing stays separate. */
export function useVideoAction(workspaceKey: string, failureMessage: string) {
  const context = useVideoTools()
  const { result, setResult, clearResult } = useToolResult(
    context.selectedFile?.file,
    workspaceKey,
  )
  const [error, setError] = useState<string | null>(null)
  const [diagnostic, setDiagnostic] = useState<string | null>(null)
  const operationVersion = useRef(0)
  const activeController = useRef<AbortController | null>(null)
  const currentSource = useRef(context.selectedFile?.file)
  currentSource.current = context.selectedFile?.file
  const { setIsProcessing, setCurrentAbortController, setProgressStartTime } =
    context
  useEffect(
    () => () => {
      operationVersion.current++
      const controller = activeController.current
      if (controller) {
        activeController.current = null
        controller.abort()
        setIsProcessing(false)
        setCurrentAbortController(null)
        setProgressStartTime(null)
      }
    },
    [
      context.selectedFile?.file,
      setIsProcessing,
      setCurrentAbortController,
      setProgressStartTime,
    ],
  )
  useEffect(() => {
    setError(null)
    setDiagnostic(null)
  }, [context.selectedFile?.file])
  const run = async (
    operation: (
      processor: FFmpegProcessor,
      signal: AbortSignal,
    ) => Promise<{ blob: Blob; filename: string; details?: string[] }>,
  ) => {
    if (
      !context.selectedFile ||
      context.isPreparing ||
      context.isProcessing ||
      activeController.current
    )
      return
    const source = context.selectedFile
    const version = ++operationVersion.current
    const controller = new AbortController()
    activeController.current = controller
    const isCurrent = () =>
      operationVersion.current === version &&
      currentSource.current === source.file &&
      activeController.current === controller
    context.setCurrentAbortController(controller)
    context.setIsProcessing(true)
    context.setProgress(0)
    context.setProgressStartTime(Date.now())
    context.setEstimatedTimeRemaining(null)
    context.setElapsedTime(null)
    context.setShowSlowProcessingWarning(false)
    setError(null)
    setDiagnostic(null)
    try {
      const processor = await context.getFfmpegProcessor()
      if (!isCurrent()) return
      const output = await operation(processor, controller.signal)
      if (!isCurrent()) return
      setResult({ ...output, sourceSize: source.size })
      downloadBlob(output.blob, output.filename)
      context.setProgress(100)
    } catch (cause) {
      if (!isCurrent()) return
      if (
        controller.signal.aborted ||
        (cause instanceof Error && cause.name === 'AbortError')
      ) {
        setError(
          'Processing was cancelled. Your original video is unchanged; you can try again.',
        )
      } else {
        setError(failureMessage)
        setDiagnostic(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (isCurrent()) {
        activeController.current = null
        context.setIsProcessing(false)
        context.setCurrentAbortController(null)
        context.setProgressStartTime(null)
      }
    }
  }
  return {
    ...context,
    result,
    clearResult,
    run,
    error,
    diagnostic,
    busy: context.isPreparing || context.isProcessing,
  }
}

export function VideoActionStatus({
  label,
  error,
  diagnostic,
  cancellable = true,
}: {
  label: string
  error: string | null
  diagnostic: string | null
  cancellable?: boolean
}) {
  const {
    isProcessing,
    progress,
    elapsedTime,
    estimatedTimeRemaining,
    showSlowProcessingWarning,
    cancelProcessing,
  } = useVideoTools()
  return (
    <>
      {isProcessing && (
        <section aria-label={label} className="space-y-3 rounded-lg border p-4">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="font-medium">{label}</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
          <Progress aria-label={label} value={progress} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {elapsedTime
                ? `Elapsed: ${elapsedTime}`
                : 'Processing locally in your browser.'}
            </span>
            {estimatedTimeRemaining && (
              <span>About {estimatedTimeRemaining} remaining</span>
            )}
            {cancellable && (
              <Button variant="outline" size="sm" onClick={cancelProcessing}>
                <Square aria-hidden="true" />
                Cancel processing
              </Button>
            )}
          </div>
          {showSlowProcessingWarning && (
            <p className="text-sm text-muted-foreground">
              Large videos can take a while in a browser. Keep this page open
              while processing.
            </p>
          )}
        </section>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground"
        >
          <p>{error}</p>
          {diagnostic && (
            <details className="mt-2">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 break-words text-muted-foreground">
                {diagnostic}
              </p>
            </details>
          )}
        </div>
      )}
    </>
  )
}
