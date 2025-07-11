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
