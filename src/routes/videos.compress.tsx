import { message, imageDimensions } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
  encodingPresets,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/compress')({
  component: VideoCompressComponent,
})

function VideoCompressComponent() {
  const t = useTranslator()
  const qualityGoals = [
    {
      value: 'smaller',
      label: t('videosCompressSmallerFile'),
      description: t('videosCompressMoreCompressionLessDetail'),
      crf: 32,
      preset: 'veryfast',
    },
    {
      value: 'balanced',
      label: t('videosCompressBalanced'),
      description: t('videosCompressAUsefulStartingPointForMost'),
      crf: 28,
      preset: 'veryfast',
    },
    {
      value: 'quality',
      label: t('videosCompressHigherQuality'),
      description: t('videosCompressKeepsMoreDetailFilesMayBe'),
      crf: 22,
      preset: 'fast',
    },
  ]
  const [settings, setSettings] = useVideoSettings('videos.compress.settings', {
    mode: 'quality',
    target: '10',
    goal: 'balanced',
    crf: 28,
    preset: 'veryfast',
  })
  const bySize = settings.mode === 'size'
  const targetMB = Number(settings.target)
  const maxBytes = Math.floor(targetMB * 1_000_000)
  const invalidSize =
    bySize && (!Number.isSafeInteger(maxBytes) || maxBytes < 10_000)
  const action = useVideoAction(
    'videos.compress',
    bySize
      ? message('videosCompressTheVideoCouldNotBeCompressed')
      : message('videosCompressTheVideoCouldNotBeCompressedText'),
  )
  const updateSettings = (changes: Partial<typeof settings>) => {
    setSettings({ ...settings, ...changes })
    action.clearResult()
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('videosCompressCompressionSettings')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('videosCompressDownloadsAsMP4WithH264Video')}
          </p>
          <div className="space-y-2">
            <Label htmlFor="video-compression-mode">
              {t('videosCompressCompressBy')}
            </Label>
            <select
              id="video-compression-mode"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={settings.mode}
              disabled={action.busy}
              onChange={(event) => updateSettings({ mode: event.target.value })}
            >
              <option value="quality">{t('videosCompressVideoQuality')}</option>
              <option value="size">{t('videosCompressMaximumFileSize')}</option>
            </select>
          </div>
          {bySize ? (
            <div className="space-y-2">
              <Label htmlFor="video-target-mb">
                {t('videosCompressMaximumSizeMB')}
              </Label>
              <Input
                id="video-target-mb"
                type="number"
                min="0.01"
                step="any"
                inputMode="decimal"
                value={settings.target}
                aria-invalid={invalidSize}
                aria-describedby="video-target-help"
                disabled={action.busy}
                onChange={(event) =>
                  updateSettings({ target: event.target.value })
                }
              />
              <p
                id="video-target-help"
                className="text-sm text-muted-foreground"
              >
                {invalidSize
                  ? t('videosCompressEnterASizeOfAtLeast')
                  : t('videosCompressTheToolMayReduceResolutionAnd')}
              </p>
            </div>
          ) : (
            <>
              <fieldset disabled={action.busy} className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  {t('videosCompressChooseYourGoal')}
                </legend>
                <div
                  role="radiogroup"
                  aria-label={t('videosCompressCompressionGoal')}
                  className="grid gap-2 sm:grid-cols-3"
                >
                  {qualityGoals.map((goal) => (
                    <label
                      key={goal.value}
                      className={`flex min-h-24 cursor-pointer items-start gap-2 rounded-lg border p-3 text-left transition-colors focus-within:outline-2 focus-within:outline-primary ${settings.goal === goal.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                    >
                      <input
                        type="radio"
                        name="compression-goal"
                        value={goal.value}
                        checked={settings.goal === goal.value}
                        onChange={() =>
                          updateSettings({
                            goal: goal.value,
                            crf: goal.crf,
                            preset: goal.preset,
                          })
                        }
                        className="mt-1 size-4 shrink-0 accent-primary"
                      />
                      <span>
                        <span className="block font-medium">{goal.label}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {goal.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  {t('videosCompressAdvancedSettings')}
                </summary>
                <fieldset
                  disabled={action.busy}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="video-crf">
                      {t('videosCompressQualityCRF')}
                    </Label>
                    <Input
                      id="video-crf"
                      type="number"
                      min="0"
                      max="51"
                      value={settings.crf}
                      onChange={(event) =>
                        updateSettings({
                          goal: 'custom',
                          crf: Math.max(
                            0,
                            Math.min(51, Number(event.target.value)),
                          ),
                        })
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('videosCompressLowerValuesKeepMoreDetailBalanced')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video-encoding-speed">
                      {t('videosCompressEncodingSpeed')}
                    </Label>
                    <select
                      id="video-encoding-speed"
                      value={settings.preset}
                      onChange={(event) =>
                        updateSettings({
                          goal: 'custom',
                          preset: event.target.value,
                        })
                      }
                      className="h-11 w-full rounded-md border bg-background px-3 text-base"
                    >
                      {Object.entries(encodingPresets).map(
                        ([preset, label]) => (
                          <option key={preset} value={preset}>
                            {t(label)}
                          </option>
                        ),
                      )}
                    </select>
                    <p className="text-sm text-muted-foreground">
                      {t('videosCompressSlowerEncodingCanProduceSmallerFiles')}
                    </p>
                  </div>
                </fieldset>
              </details>
            </>
          )}
          <VideoActionStatus
            label={
              bySize
                ? t('videosCompressCompressingToSizeLimit')
                : t('videosCompressCompressingVideo')
            }
            indeterminate={bySize}
            error={action.error}
            diagnostic={action.diagnostic}
          />
          <Button
            className="min-h-11 w-full sm:w-auto sm:self-end"
            disabled={action.busy || !action.selectedFile || invalidSize}
            onClick={() =>
              void action.run(async (processor, signal) => ({
                blob: bySize
                  ? await processor.compressToSize(maxBytes, signal)
                  : await processor.compressVideo({
                      crf: settings.crf,
                      preset: settings.preset,
                      signal,
                    }),
                filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}_compressed.mp4`,
                details: [
                  'MP4 · H.264 video · AAC audio',
                  ...(bySize
                    ? [message('videosCompressMeetsTheMBLimit', { targetMB })]
                    : []),
                  ...(!bySize && action.selectedFile?.dimensions
                    ? [
                        message('mediaDimensionsPixels', {
                          dimensions: imageDimensions(
                            action.selectedFile.dimensions.width,
                            action.selectedFile.dimensions.height,
                          ),
                        }),
                      ]
                    : []),
                  ...(action.selectedFile?.duration
                    ? [
                        message('videosCompressSeconds', {
                          duration: action.selectedFile.duration.toFixed(2),
                        }),
                      ]
                    : []),
                ],
              }))
            }
          >
            {action.isProcessing
              ? t('videosCompressCompressing')
              : t('videosCompressCompressVideo')}
          </Button>
        </CardContent>
      </Card>
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
        disabled={action.busy}
      />
    </div>
  )
}
