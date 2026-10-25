import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
  formatOptions,
  videoCodecOptions,
  audioCodecOptions,
  getCompatibleCodecs,
  getCompatibleResolutions,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/convert')({
  component: VideoConvertComponent,
  head: () => ({
    meta: [
      {
        title:
          'Video Converter - Free Browser-Based Video Format Conversion | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based video format converter. Convert between MP4, WebM, AVI, MOV, and more with custom codec selection. Process videos entirely in your browser.',
      },
      {
        name: 'keywords',
        content:
          'free video converter, MP4 converter, WebM converter, browser video format conversion, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Video Converter - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based video format converter. Convert between multiple formats with complete privacy.',
      },
    ],
  }),
})

function VideoConvertComponent() {
  const action = useVideoAction(
    'videos.convert',
    'The video could not be converted. Try another format or change the advanced settings.',
  )
  const [settings, setSettings] = useVideoSettings('videos.convert.settings', {
    format: 'mp4',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    preset: 'veryfast',
    resolution: 'original',
    width: '',
    height: '',
    aspect: true,
  })
  const resolutions = action.selectedFile?.dimensions
    ? getCompatibleResolutions(
        action.selectedFile.dimensions.width,
        action.selectedFile.dimensions.height,
      )
    : []
  useEffect(() => {
    if (
      settings.resolution !== 'original' &&
      settings.resolution !== 'custom' &&
      !resolutions.some(
        (resolution) => resolution.value === settings.resolution,
      )
    )
      setSettings((previous) => ({ ...previous, resolution: 'original' }))
  }, [action.selectedFile?.file, settings.resolution, resolutions, setSettings])
  const customInvalid =
    settings.resolution === 'custom' &&
    ![settings.width, settings.height].every(
      (value) =>
        Number(value) >= 2 &&
        Number.isInteger(Number(value)) &&
        Number(value) % 2 === 0,
    )
  return (
    <div className="space-y-6">
      <fieldset disabled={action.busy} className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="video-output-format">Output format</Label>
          <select
            id="video-output-format"
            className="h-11 w-full rounded-md border bg-background px-3 text-base"
            value={settings.format}
            onChange={(event) => {
              const format = event.target.value
              setSettings({
                ...settings,
                format,
                videoCodec: getCompatibleCodecs(format, 'video')[0],
                audioCodec: getCompatibleCodecs(format, 'audio')[0],
              })
            }}
          >
            {formatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.description}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">
            MP4 is a good choice for sharing and playback.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-output-size">Video size</Label>
          <select
            id="video-output-size"
            className="h-11 w-full rounded-md border bg-background px-3 text-base"
            value={settings.resolution}
            onChange={(event) =>
              setSettings({ ...settings, resolution: event.target.value })
            }
          >
            <option value="original">Keep original dimensions</option>
            {resolutions.map((resolution) => (
              <option key={resolution.value} value={resolution.value}>
                {resolution.label}
              </option>
            ))}
            <option value="custom">Custom dimensions</option>
          </select>
          <p className="text-sm text-muted-foreground">
            A smaller picture usually makes a smaller file.
          </p>
        </div>
      </fieldset>
      {settings.resolution === 'custom' && (
        <fieldset disabled={action.busy} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="video-width">Width (pixels)</Label>
            <Input
              id="video-width"
              type="number"
              min="2"
              step="2"
              value={settings.width}
              aria-invalid={customInvalid}
              aria-describedby="video-dimension-help"
              onChange={(event) =>
                setSettings({ ...settings, width: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-height">Height (pixels)</Label>
            <Input
              id="video-height"
              type="number"
              min="2"
              step="2"
              value={settings.height}
              aria-invalid={customInvalid}
              aria-describedby="video-dimension-help"
              onChange={(event) =>
                setSettings({ ...settings, height: event.target.value })
              }
            />
          </div>
          <p
            id="video-dimension-help"
            className="text-sm text-muted-foreground sm:col-span-2"
          >
            Enter even dimensions of at least 2 pixels for video compatibility.
          </p>
        </fieldset>
      )}
      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced settings
        </summary>
        <fieldset
          disabled={action.busy}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="video-codec">Video codec</Label>
            <select
              id="video-codec"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={settings.videoCodec}
              onChange={(event) =>
                setSettings({ ...settings, videoCodec: event.target.value })
              }
            >
              {videoCodecOptions
                .filter((codec) =>
                  getCompatibleCodecs(settings.format, 'video').includes(
                    codec.value,
                  ),
                )
                .map((codec) => (
                  <option key={codec.value} value={codec.value}>
                    {codec.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="video-audio-codec">Audio codec</Label>
            <select
              id="video-audio-codec"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={settings.audioCodec}
              onChange={(event) =>
                setSettings({ ...settings, audioCodec: event.target.value })
              }
            >
              {audioCodecOptions
                .filter((codec) =>
                  getCompatibleCodecs(settings.format, 'audio').includes(
                    codec.value,
                  ),
                )
                .map((codec) => (
                  <option key={codec.value} value={codec.value}>
                    {codec.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="convert-speed">Encoding speed</Label>
            <select
              id="convert-speed"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={settings.preset}
              onChange={(event) =>
                setSettings({ ...settings, preset: event.target.value })
              }
            >
              {['ultrafast', 'veryfast', 'fast', 'medium', 'slow'].map(
                (preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ),
              )}
            </select>
          </div>
          {settings.resolution !== 'original' && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.aspect}
                onChange={(event) =>
                  setSettings({ ...settings, aspect: event.target.checked })
                }
              />
              Keep original aspect ratio
            </label>
          )}
        </fieldset>
      </details>
      <VideoActionStatus
        label="Converting video"
        error={action.error}
        diagnostic={action.diagnostic}
      />
      <Button
        className="min-h-11 w-full sm:w-auto"
        disabled={action.busy || !action.selectedFile || customInvalid}
        onClick={() =>
          void action.run(async (processor, signal) => ({
            blob: await processor.convertVideo({
              targetFormat: settings.format,
              videoCodec: settings.videoCodec,
              audioCodec: settings.audioCodec,
              preset: settings.preset,
              ...(settings.resolution !== 'original'
                ? {
                    downscale: {
                      enabled: true,
                      ...(settings.resolution === 'custom'
                        ? {
                            customWidth: Number(settings.width),
                            customHeight: Number(settings.height),
                          }
                        : { resolution: settings.resolution }),
                      maintainAspectRatio: settings.aspect,
                    },
                  }
                : {}),
              signal,
            }),
            filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}.${settings.format}`,
            details: [
              `${settings.format.toUpperCase()} video`,
              settings.resolution === 'original'
                ? 'Original dimensions'
                : settings.resolution === 'custom'
                  ? `${settings.width} × ${settings.height} pixel bounding box`
                  : settings.resolution.replace('x', ' × '),
            ],
          }))
        }
      >
        {action.isProcessing
          ? 'Converting…'
          : `Convert to ${settings.format.toUpperCase()}`}
      </Button>
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
      />
    </div>
  )
}
