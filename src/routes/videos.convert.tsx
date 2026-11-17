import { imageDimensions, message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { isAnimationFormat } from '@/lib/animation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
  getFormatOptions,
  getVideoCodecOptions,
  getAudioCodecOptions,
  getCompatibleCodecs,
  getCompatibleResolutions,
  encodingPresets,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/convert')({
  component: VideoConvertComponent,
})

function VideoConvertComponent() {
  const t = useTranslator()
  const action = useVideoAction(
    'videos.convert',
    message('videosConvertTheVideoCouldNotBeConverted'),
  )
  const [settings, updateSettings] = useVideoSettings(
    'videos.convert.settings',
    {
      format: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      preset: 'veryfast',
      resolution: 'original',
      width: '',
      height: '',
      aspect: true,
      fps: '15',
      loop: true,
    },
  )
  const setSettings: typeof updateSettings = (next) => {
    action.clearResult()
    updateSettings(next)
  }
  const animationOutput = isAnimationFormat(settings.format)
  const resolutions = action.selectedFile?.dimensions
    ? getCompatibleResolutions(
        action.selectedFile.dimensions.width,
        action.selectedFile.dimensions.height,
        t,
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
        Number(value) >= (animationOutput ? 1 : 2) &&
        Number.isInteger(Number(value)) &&
        (animationOutput || Number(value) % 2 === 0),
    )
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('videosConvertConversionSettings')}
          </h2>
          <fieldset
            disabled={action.busy}
            className="grid gap-5 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="video-output-format">
                {t('videosConvertOutputFormat')}
              </Label>
              <select
                id="video-output-format"
                className="h-11 w-full rounded-md border bg-background px-3 text-base"
                value={settings.format}
                onChange={(event) => {
                  const format = event.target.value
                  setSettings({
                    ...settings,
                    format,
                    videoCodec:
                      getCompatibleCodecs(format, 'video')[0] ??
                      settings.videoCodec,
                    audioCodec:
                      getCompatibleCodecs(format, 'audio')[0] ??
                      settings.audioCodec,
                  })
                }}
              >
                {getFormatOptions(t).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} — {option.description}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">
                {animationOutput
                  ? t('videosConvertAnimatedImagesHaveNoAudioSmaller')
                  : t('videosConvertMP4IsAGoodChoiceFor')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="video-output-size">
                {t('videosConvertVideoSize')}
              </Label>
              <select
                id="video-output-size"
                className="h-11 w-full rounded-md border bg-background px-3 text-base"
                value={settings.resolution}
                onChange={(event) =>
                  setSettings({ ...settings, resolution: event.target.value })
                }
              >
                <option value="original">
                  {t('videosConvertKeepOriginalDimensions')}
                </option>
                {resolutions.map((resolution) => (
                  <option key={resolution.value} value={resolution.value}>
                    {resolution.label}
                  </option>
                ))}
                <option value="custom">
                  {t('videosConvertCustomDimensions')}
                </option>
              </select>
              <p className="text-sm text-muted-foreground">
                {t('videosConvertASmallerPictureUsuallyMakesA')}
              </p>
            </div>
          </fieldset>
          {settings.resolution === 'custom' && (
            <fieldset
              disabled={action.busy}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="video-width">
                  {t('videosConvertWidthPixels')}
                </Label>
                <Input
                  id="video-width"
                  type="number"
                  min={animationOutput ? 1 : 2}
                  step={animationOutput ? 1 : 2}
                  value={settings.width}
                  aria-invalid={customInvalid}
                  aria-describedby="video-dimension-help"
                  onChange={(event) =>
                    setSettings({ ...settings, width: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-height">
                  {t('videosConvertHeightPixels')}
                </Label>
                <Input
                  id="video-height"
                  type="number"
                  min={animationOutput ? 1 : 2}
                  step={animationOutput ? 1 : 2}
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
                {animationOutput
                  ? t('videosConvertEnterPositiveDimensionsInPixels')
                  : t('videosConvertEnterEvenDimensionsOfAtLeast')}
              </p>
            </fieldset>
          )}
          {settings.resolution !== 'original' && (
            <fieldset disabled={action.busy}>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.aspect}
                  onChange={(event) =>
                    setSettings({ ...settings, aspect: event.target.checked })
                  }
                />
                {t('videosConvertKeepOriginalAspectRatio')}
              </label>
            </fieldset>
          )}
          {animationOutput && (
            <fieldset
              disabled={action.busy}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="animation-fps">
                  {t('videosConvertFrameRateFps')}
                </Label>
                <select
                  id="animation-fps"
                  className="h-11 w-full rounded-md border bg-background px-3 text-base"
                  value={settings.fps}
                  onChange={(event) =>
                    setSettings({ ...settings, fps: event.target.value })
                  }
                >
                  {[5, 10, 15, 20, 24, 30, 60].map((fps) => (
                    <option key={fps} value={fps}>
                      {fps}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.loop}
                  onChange={(event) =>
                    setSettings({ ...settings, loop: event.target.checked })
                  }
                />
                {t('videosConvertLoopAnimationContinuously')}
              </label>
            </fieldset>
          )}
          {!animationOutput && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t('videosConvertAdvancedSettings')}
              </summary>
              <fieldset
                disabled={action.busy}
                className="mt-4 grid gap-4 sm:grid-cols-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="video-codec">
                    {t('videosConvertVideoCodec')}
                  </Label>
                  <select
                    id="video-codec"
                    className="h-11 w-full rounded-md border bg-background px-3 text-base"
                    value={settings.videoCodec}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        videoCodec: event.target.value,
                      })
                    }
                  >
                    {getVideoCodecOptions(t)
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
                  <Label htmlFor="video-audio-codec">
                    {t('videosConvertAudioCodec')}
                  </Label>
                  <select
                    id="video-audio-codec"
                    className="h-11 w-full rounded-md border bg-background px-3 text-base"
                    value={settings.audioCodec}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        audioCodec: event.target.value,
                      })
                    }
                  >
                    {getAudioCodecOptions(t)
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
                  <Label htmlFor="convert-speed">
                    {t('videosConvertEncodingSpeed')}
                  </Label>
                  <select
                    id="convert-speed"
                    className="h-11 w-full rounded-md border bg-background px-3 text-base"
                    value={settings.preset}
                    onChange={(event) =>
                      setSettings({ ...settings, preset: event.target.value })
                    }
                  >
                    {(
                      [
                        'ultrafast',
                        'veryfast',
                        'fast',
                        'medium',
                        'slow',
                      ] as const
                    ).map((preset) => (
                      <option key={preset} value={preset}>
                        {t(encodingPresets[preset])}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>
            </details>
          )}
          {action.selectedFile?.animation && (
            <p className="text-sm text-muted-foreground">
              {t('videosConvertConvertsOneCompleteAnimationCycle')}
            </p>
          )}
          <VideoActionStatus
            label={
              animationOutput
                ? t('videosConvertCreatingAnimation')
                : t('videosConvertConvertingVideo')
            }
            indeterminate={animationOutput}
            error={action.error}
            diagnostic={action.diagnostic}
          />
          <Button
            className="min-h-11 w-full sm:w-auto sm:self-end"
            disabled={action.busy || !action.selectedFile || customInvalid}
            onClick={() =>
              void action.run(async (processor, signal) => ({
                blob: await processor.convertVideo({
                  targetFormat: settings.format,
                  videoCodec: settings.videoCodec,
                  audioCodec: settings.audioCodec,
                  preset: settings.preset,
                  ...(animationOutput
                    ? {
                        animation: {
                          fps: Number(settings.fps),
                          loop: settings.loop,
                        },
                      }
                    : {}),
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
                  message(
                    animationOutput
                      ? 'videosConvertAnimationNoAudio'
                      : 'videosConvertVideoFormat',
                    { format: settings.format.toUpperCase() },
                  ),
                  ...(animationOutput
                    ? [
                        message(
                          settings.loop
                            ? 'videosConvertFpsLoop'
                            : 'videosConvertFpsOnce',
                          {
                            fps: settings.fps,
                          },
                        ),
                      ]
                    : []),
                  settings.resolution === 'original'
                    ? message('videosConvertOriginalDimensions')
                    : settings.resolution === 'custom'
                      ? message('videosConvertPixelBoundingBox', {
                          dimensions: imageDimensions(
                            Number(settings.width),
                            Number(settings.height),
                          ),
                        })
                      : message('mediaDimensions', {
                          dimensions: {
                            ltr: settings.resolution.replace('x', ' × '),
                          },
                        }),
                ],
              }))
            }
          >
            {action.isProcessing
              ? t('videosConvertConverting')
              : t('videosConvertConvertTo', {
                  format: settings.format.toUpperCase(),
                })}
          </Button>
        </CardContent>
      </Card>
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
      />
    </div>
  )
}
