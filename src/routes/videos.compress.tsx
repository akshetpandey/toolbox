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
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/compress')({
  component: VideoCompressComponent,
})

const qualityGoals = [
  {
    value: 'smaller',
    label: 'Smaller file',
    description: 'More compression, less detail.',
    crf: 32,
    preset: 'veryfast',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'A useful starting point for most videos.',
    crf: 28,
    preset: 'veryfast',
  },
  {
    value: 'quality',
    label: 'Higher quality',
    description: 'Keeps more detail; files may be larger.',
    crf: 22,
    preset: 'fast',
  },
]
function VideoCompressComponent() {
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
      ? 'The video could not be compressed. Try a larger size limit or choose another file.'
      : 'The video could not be compressed. Try another quality setting or choose another file.',
  )
  const updateSettings = (changes: Partial<typeof settings>) => {
    setSettings({ ...settings, ...changes })
    action.clearResult()
  }
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Compression settings</h2>
          <p className="text-sm text-muted-foreground">
            Downloads as MP4 with H.264 video and AAC audio.
          </p>
          <div className="space-y-2">
            <Label htmlFor="video-compression-mode">Compress by</Label>
            <select
              id="video-compression-mode"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={settings.mode}
              disabled={action.busy}
              onChange={(event) => updateSettings({ mode: event.target.value })}
            >
              <option value="quality">Video quality</option>
              <option value="size">Maximum file size</option>
            </select>
          </div>
          {bySize ? (
            <div className="space-y-2">
              <Label htmlFor="video-target-mb">Maximum size (MB)</Label>
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
                  ? 'Enter a size of at least 0.01 MB.'
                  : 'The tool may reduce resolution and make more than one attempt to fit the limit.'}
              </p>
            </div>
          ) : (
            <>
              <fieldset disabled={action.busy} className="space-y-3">
                <legend className="mb-3 text-sm font-medium">
                  Choose your goal
                </legend>
                <div
                  role="radiogroup"
                  aria-label="Compression goal"
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
                  Advanced settings
                </summary>
                <fieldset
                  disabled={action.busy}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="video-crf">Quality (CRF)</Label>
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
                      Lower values keep more detail. Balanced uses 28.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="video-encoding-speed">Encoding speed</Label>
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
                      {[
                        'ultrafast',
                        'superfast',
                        'veryfast',
                        'faster',
                        'fast',
                        'medium',
                        'slow',
                        'slower',
                        'veryslow',
                      ].map((preset) => (
                        <option key={preset} value={preset}>
                          {preset}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-muted-foreground">
                      Slower encoding can produce smaller files.
                    </p>
                  </div>
                </fieldset>
              </details>
            </>
          )}
          <VideoActionStatus
            label={bySize ? 'Compressing to size limit' : 'Compressing video'}
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
                  ...(bySize ? [`Meets the ${targetMB} MB limit`] : []),
                  ...(!bySize && action.selectedFile?.dimensions
                    ? [
                        `${action.selectedFile.dimensions.width} × ${action.selectedFile.dimensions.height} pixels`,
                      ]
                    : []),
                  ...(action.selectedFile?.duration
                    ? [`${action.selectedFile.duration.toFixed(2)} seconds`]
                    : []),
                ],
              }))
            }
          >
            {action.isProcessing ? 'Compressing…' : 'Compress video'}
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
