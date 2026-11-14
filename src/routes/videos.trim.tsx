import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResultCard } from '@/components/ResultCard'
import { useWorkspaceState } from '@/hooks/useWorkspaceState'
import { useVideoAction, VideoActionStatus } from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/trim')({
  component: VideoTrimComponent,
})

function VideoTrimComponent() {
  const action = useVideoAction(
    'videos.trim',
    'The clip could not be created. Try another time range or replace the file.',
  )
  const source = action.selectedFile?.file
  const duration = Number.isFinite(action.selectedFile?.duration)
    ? (action.selectedFile?.duration ?? 0)
    : 0
  const [range, setRange] = useWorkspaceState<{
    source: File | undefined
    duration: number
    start: string
    end: string
  }>('videos.trim.range', {
    source,
    duration,
    start: '0',
    end: String(duration),
  })
  const current =
    range.source === source
      ? range
      : { source, duration, start: '0', end: String(duration) }
  useEffect(() => {
    if (range.source !== source || (duration > 0 && range.duration === 0))
      setRange({ source, duration, start: '0', end: String(duration) })
  }, [source, duration, range.source, range.duration, setRange])
  const start = Number(current.start)
  const end = Number(current.end)
  const invalid =
    !current.start.trim() ||
    !current.end.trim() ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start >= end ||
    end > duration
  const quickRange = (startAt: number, length: number) => {
    const start = Math.max(0, Math.min(startAt, duration))
    setRange({
      source,
      duration,
      start: String(start),
      end: String(Math.min(duration, start + length)),
    })
  }
  const extension =
    action.selectedFile?.animation?.format ??
    action.selectedFile?.name.split('.').pop() ??
    'mp4'
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Clip settings</h2>
          <p className="text-sm text-muted-foreground">
            Choose the section to keep. Your original video stays unchanged.
          </p>
          {duration > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>Original: {duration.toFixed(2)} s</span>
                <span>Selected: {Math.max(0, end - start).toFixed(2)} s</span>
              </div>
              <div className="space-y-3" aria-label="Clip timeline">
                <div className="space-y-1">
                  <Label htmlFor="trim-start-slider">Clip start</Label>
                  <input
                    id="trim-start-slider"
                    type="range"
                    min="0"
                    max={Math.max(0, end - Math.min(0.01, duration))}
                    step="0.01"
                    value={Math.max(0, start)}
                    disabled={action.busy}
                    onChange={(event) =>
                      setRange({ ...current, start: event.target.value })
                    }
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="trim-end-slider">Clip end</Label>
                  <input
                    id="trim-end-slider"
                    type="range"
                    min={Math.min(duration, start + Math.min(0.01, duration))}
                    max={duration}
                    step="0.01"
                    value={Math.min(duration, end)}
                    disabled={action.busy}
                    onChange={(event) =>
                      setRange({ ...current, end: event.target.value })
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <span className="text-sm font-medium">Quick selections</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                variant="outline"
                disabled={action.busy || duration <= 0}
                onClick={() => quickRange(0, 30)}
              >
                First 30 s
              </Button>
              <Button
                variant="outline"
                disabled={action.busy || duration <= 0}
                onClick={() => quickRange(0, 60)}
              >
                First minute
              </Button>
              <Button
                variant="outline"
                disabled={action.busy || duration <= 0}
                onClick={() => quickRange(Math.max(0, duration - 30), 30)}
              >
                Last 30 s
              </Button>
              <Button
                variant="outline"
                disabled={action.busy || duration <= 0}
                onClick={() => quickRange(0, duration)}
              >
                Entire video
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Presets stop at the end of your video.
            </p>
          </div>
          <fieldset
            disabled={action.busy || duration <= 0}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="trim-start">Start (seconds)</Label>
              <Input
                id="trim-start"
                type="number"
                min="0"
                max={duration}
                step="0.001"
                value={current.start}
                aria-invalid={duration > 0 && invalid}
                aria-describedby={
                  invalid && duration > 0 ? 'trim-error' : undefined
                }
                onChange={(event) =>
                  setRange({ ...current, start: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trim-end">End (seconds)</Label>
              <Input
                id="trim-end"
                type="number"
                min="0"
                max={duration}
                step="0.001"
                value={current.end}
                aria-invalid={duration > 0 && invalid}
                aria-describedby={
                  invalid && duration > 0 ? 'trim-error' : undefined
                }
                onChange={(event) =>
                  setRange({ ...current, end: event.target.value })
                }
              />
            </div>
          </fieldset>
          {duration > 0 && invalid && (
            <p
              id="trim-error"
              role="alert"
              className="text-sm text-destructive"
            >
              Choose a start at or after 0 and an end after the start, up to{' '}
              {duration.toFixed(3)} seconds.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            The clip keeps its original format. Use Convert video for GIF, APNG,
            or another output format.
          </p>
          <VideoActionStatus
            label="Trimming video"
            error={action.error}
            diagnostic={action.diagnostic}
          />
          <Button
            className="min-h-11 w-full sm:w-auto sm:self-end"
            disabled={action.busy || !source || duration <= 0 || invalid}
            onClick={() =>
              void action.run(async (processor, signal) => ({
                blob: await processor.trimVideo({
                  startTime: String(start),
                  endTime: String(end),
                  signal,
                }),
                filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}_trimmed.${extension}`,
                details: [
                  `${start.toFixed(2)}–${end.toFixed(2)} s · ${(end - start).toFixed(2)} s clip`,
                  extension.toUpperCase(),
                ],
              }))
            }
          >
            {action.isProcessing ? 'Trimming…' : 'Create clip'}
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
