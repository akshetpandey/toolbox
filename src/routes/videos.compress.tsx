import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/compress')({
  component: VideoCompressComponent,
  head: () => ({
    meta: [
      {
        title:
          'Video Compressor - Free Browser-Based Video Compression | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based video compression tool. Reduce video file sizes with customizable quality settings. Process videos entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'free video compressor, reduce video size, video compression, browser video editor, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Video Compressor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based video compression. Reduce file sizes with customizable quality settings.',
      },
    ],
  }),
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
  const action = useVideoAction(
    'videos.compress',
    'The video could not be compressed. Try another quality setting or choose another file.',
  )
  const [settings, setSettings] = useVideoSettings('videos.compress.settings', {
    goal: 'balanced',
    crf: 28,
    preset: 'veryfast',
  })
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Downloads as MP4 with H.264 video and AAC audio.
      </p>
      <fieldset disabled={action.busy} className="space-y-3">
        <legend className="mb-3 text-sm font-medium">Choose your goal</legend>
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
                  setSettings({
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
                setSettings({
                  ...settings,
                  goal: 'custom',
                  crf: Math.max(0, Math.min(51, Number(event.target.value))),
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
                setSettings({
                  ...settings,
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
      <VideoActionStatus
        label="Compressing video"
        error={action.error}
        diagnostic={action.diagnostic}
      />
      <Button
        className="min-h-11 w-full sm:w-auto"
        disabled={action.busy || !action.selectedFile}
        onClick={() =>
          void action.run(async (processor, signal) => ({
            blob: await processor.compressVideo({
              crf: settings.crf,
              preset: settings.preset,
              signal,
            }),
            filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}_compressed.mp4`,
            details: [
              'MP4 · H.264 video · AAC audio',
              ...(action.selectedFile?.dimensions
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
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
      />
    </div>
  )
}
