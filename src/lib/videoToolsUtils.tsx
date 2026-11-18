import { imageDimensions, message, renderMessage } from '@/i18n/messages'
import type { LocalizedMessage } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { workspaceEnglish as english } from '@/i18n/workspaceMessages'
import type { Translator } from '@/i18n/messages'
import {
  Play,
  Globe,
  Archive,
  Monitor,
  Square,
  Info,
  Settings,
  Zap,
  Scissors,
  Volume2,
  Merge,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { useToolResult } from '@/components/ResultCard'
import type { ToolResult } from '@/components/ResultCard'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { downloadBlob } from '@/lib/shared'
import { MediaInputError } from '@/lib/media'
import type { FFmpegProcessor } from '@/lib/ffmpeg'

export const getVideoTabs = (t: Translator) => [
  { value: 'metadata', label: t('videoToolsUtilsMetadata'), icon: Info },
  {
    value: 'convert',
    label: t('videoToolsUtilsConvert'),
    icon: Settings,
  },
  { value: 'compress', label: t('videoToolsUtilsCompress'), icon: Zap },
  { value: 'trim', label: t('videoToolsUtilsTrim'), icon: Scissors },
  { value: 'extract', label: t('videoToolsUtilsExtract'), icon: Volume2 },
  { value: 'join', label: t('videoToolsUtilsJoin'), icon: Merge },
]

// Format and codec compatibility definitions
export const getFormatOptions = (t: Translator) =>
  [
    {
      value: 'mp4',
      icon: Play,
      label: 'MP4',
      description: t('videoToolsUtilsUniversalCompatibility'),
    },
    {
      value: 'webm',
      icon: Globe,
      label: 'WebM',
      description: t('videoToolsUtilsWebOptimized'),
    },
    {
      value: 'mkv',
      icon: Archive,
      label: 'MKV',
      description: t('videoToolsUtilsFlexibleContainer'),
    },
    {
      value: 'avi',
      icon: Monitor,
      label: 'AVI',
      description: t('videoToolsUtilsLegacyFormat'),
    },
    {
      value: 'gif',
      label: 'GIF',
      description: t('videoToolsUtilsAnimatedImageNoAudio'),
    },
    {
      value: 'apng',
      label: 'APNG',
      description: t('videoToolsUtilsAnimatedPNGNoAudio'),
    },
    {
      value: 'webp',
      label: 'WebP',
      description: t('videoToolsUtilsAnimatedImageNoAudio'),
    },
  ] as const

export const formatOptions = getFormatOptions(english)

export const getVideoCodecOptions = (t: Translator) =>
  [
    {
      value: 'libx264',
      label: 'H.264',
      description: t('videoToolsUtilsBestCompatibility'),
    },
    {
      value: 'libx265',
      label: 'H.265',
      description: t('videoToolsUtilsHigherCompression'),
    },
    {
      value: 'libvpx',
      label: 'VP8',
      description: t('videoToolsUtilsWebStandard'),
    },
  ] as const

export const videoCodecOptions = getVideoCodecOptions(english)

export const getAudioCodecOptions = (t: Translator) =>
  [
    {
      value: 'aac',
      label: 'AAC',
      description: t('videoToolsUtilsHighQuality'),
    },
    {
      value: 'mp3',
      label: 'MP3',
      description: t('videoToolsUtilsUniversal'),
    },
    {
      value: 'libopus',
      label: 'Opus',
      description: t('videoToolsUtilsLowLatency'),
    },
  ] as const

export const audioCodecOptions = getAudioCodecOptions(english)

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

const portraitResolutions = [
  ['4K', 2160, 3840, 'videoToolsUtilsUltraHDPortrait'],
  ['1440p', 1440, 2560, 'videoToolsUtilsQHDPortrait'],
  ['1080p', 1080, 1920, 'videoToolsUtilsFullHDPortrait'],
  ['720p', 720, 1280, 'videoToolsUtilsHDPortrait'],
  ['480p', 480, 854, 'videoToolsUtilsSDPortrait'],
  ['360p', 360, 640, 'videoToolsUtilsLowPortrait'],
] as const

// Common resolution presets for both orientations
export const getCommonResolutions = (t = english) => {
  return [
    // Widescreen (16:9) - Horizontal
    {
      value: '3840x2160',
      label: '4K (3840×2160)',
      description: t('videoToolsUtilsUltraHD'),
    },
    { value: '2560x1440', label: '1440p (2560×1440)', description: 'QHD' },
    {
      value: '1920x1080',
      label: '1080p (1920×1080)',
      description: t('videoToolsUtilsFullHD'),
    },
    { value: '1280x720', label: '720p (1280×720)', description: 'HD' },
    { value: '854x480', label: '480p (854×480)', description: 'SD' },
    {
      value: '640x360',
      label: '360p (640×360)',
      description: t('videoToolsUtilsLow'),
    },

    // Widescreen (16:9) - Vertical
    ...portraitResolutions.map(([resolution, width, height, description]) => ({
      value: `${width}x${height}`,
      label: t('videoToolsUtilsPortraitResolution', {
        resolution,
        dimensions: imageDimensions(width, height),
      }),
      description: t(description),
    })),

    // Standard (4:3) - Horizontal
    {
      value: '1440x1080',
      label: '1440×1080',
      description: t('videoToolsUtils43HD'),
    },
    {
      value: '1024x768',
      label: '1024×768',
      description: t('videoToolsUtils43Standard'),
    },
    {
      value: '800x600',
      label: '800×600',
      description: t('videoToolsUtils43Low'),
    },
    {
      value: '640x480',
      label: '640×480',
      description: t('videoToolsUtils43Basic'),
    },

    // Standard (4:3) - Vertical
    {
      value: '1080x1440',
      label: '1080×1440',
      description: t('videoToolsUtils43HDPortrait'),
    },
    {
      value: '768x1024',
      label: '768×1024',
      description: t('videoToolsUtils43StandardPortrait'),
    },
    {
      value: '600x800',
      label: '600×800',
      description: t('videoToolsUtils43LowPortrait'),
    },
    {
      value: '480x640',
      label: '480×640',
      description: t('videoToolsUtils43BasicPortrait'),
    },

    // Square
    {
      value: '1080x1080',
      label: '1080×1080',
      description: t('videoToolsUtilsSquareHD'),
    },
    {
      value: '720x720',
      label: '720×720',
      description: t('videoToolsUtilsSquareStandard'),
    },
    {
      value: '480x480',
      label: '480×480',
      description: t('videoToolsUtilsSquareLow'),
    },
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
  t = english,
) => {
  const videoAspectRatio = calculateAspectRatio(videoWidth, videoHeight)
  const allResolutions = getCommonResolutions(t)

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
  const t = useTranslator()
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
                      <span className="ml-2 text-xs">
                        {t('videoToolsUtilsNotSupported')}
                      </span>
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
export function useVideoAction(
  workspaceKey: string,
  failureMessage: LocalizedMessage,
) {
  const context = useVideoTools()
  const { result, setResult, clearResult } = useToolResult(
    context.selectedFile?.file,
    workspaceKey,
  )
  const [error, setError] = useState<LocalizedMessage | null>(null)
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
    ) => Promise<ToolResult>,
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
    clearResult()
    setError(null)
    setDiagnostic(null)
    try {
      const processor = await context.getFfmpegProcessor()
      if (!isCurrent()) return
      controller.signal.throwIfAborted()
      const output = await operation(processor, controller.signal)
      if (!isCurrent()) return
      controller.signal.throwIfAborted()
      setResult({ ...output, sourceSize: source.size })
      downloadBlob(output.blob, output.filename)
      context.setProgress(100)
    } catch (cause) {
      if (!isCurrent()) return
      if (
        controller.signal.aborted ||
        (cause instanceof Error && cause.name === 'AbortError')
      ) {
        setError(message('videoToolsUtilsProcessingCancelledYouCanTryAgain'))
      } else if (cause instanceof MediaInputError) {
        setError(message(cause.key, cause.values))
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

export const encodingPresets = {
  ultrafast: 'videoToolsUtilsPresetUltrafast',
  superfast: 'videoToolsUtilsPresetSuperfast',
  veryfast: 'videoToolsUtilsPresetVeryfast',
  faster: 'videoToolsUtilsPresetFaster',
  fast: 'videoToolsUtilsPresetFast',
  medium: 'videoToolsUtilsPresetMedium',
  slow: 'videoToolsUtilsPresetSlow',
  slower: 'videoToolsUtilsPresetSlower',
  veryslow: 'videoToolsUtilsPresetVeryslow',
} as const

export function VideoActionStatus({
  label,
  error,
  diagnostic,
  cancellable = true,
  indeterminate = false,
}: {
  label: string
  error: LocalizedMessage | null
  diagnostic: string | null
  cancellable?: boolean
  indeterminate?: boolean
}) {
  const t = useTranslator()
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
            {!indeterminate && <span>{progress.toFixed(1)}%</span>}
          </div>
          {indeterminate ? (
            <progress
              aria-label={label}
              className="h-2 w-full accent-primary"
            />
          ) : (
            <Progress aria-label={label} value={progress} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {elapsedTime
                ? t('videoToolsUtilsElapsed', { elapsedTime })
                : t('videoToolsUtilsProcessingLocallyInYourBrowser')}
            </span>
            {!indeterminate && estimatedTimeRemaining && (
              <span>
                {t('videoToolsUtilsRemaining', {
                  time: estimatedTimeRemaining,
                })}
              </span>
            )}
            {cancellable && (
              <Button variant="outline" size="sm" onClick={cancelProcessing}>
                <Square aria-hidden="true" />
                {t('videoToolsUtilsCancelProcessing')}
              </Button>
            )}
          </div>
          {showSlowProcessingWarning && (
            <p className="text-sm text-muted-foreground">
              {t('videoToolsUtilsLargeVideosCanTakeAWhile')}
            </p>
          )}
        </section>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground"
        >
          <p>{renderMessage(t, error)}</p>
          {diagnostic && (
            <details className="mt-2">
              <summary className="cursor-pointer">
                {t('videoToolsUtilsTechnicalDetails')}
              </summary>
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
