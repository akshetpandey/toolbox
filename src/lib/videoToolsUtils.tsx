import { Play, Globe, Archive, Monitor } from 'lucide-react'

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
  { value: 'libvpx-vp9', label: 'VP9', description: 'Web standard' },
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
    video: ['libvpx-vp9'],
    audio: ['libopus'],
  },
  mkv: {
    video: ['libx264', 'libx265', 'libvpx-vp9'],
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
