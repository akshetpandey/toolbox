import { message } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/extract')({
  component: VideoExtractComponent,
})

function VideoExtractComponent() {
  const t = useTranslator()
  const action = useVideoAction(
    'videos.extract',
    message('videosExtractTheAudioCouldNotBeExtracted'),
  )
  const [audioFormat, setAudioFormat] = useVideoSettings(
    'videos.extract.format',
    'mp3',
  )
  const metadata = action.selectedFile
    ? action.metadata[action.selectedFile.name]
    : undefined
  const noAudio =
    metadata &&
    metadata.format.nb_streams > 0 &&
    metadata.audio_streams.length === 0
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('videosExtractAudioSettings')}
          </h2>
          <div className="space-y-2">
            <Label htmlFor="audio-format">
              {t('videosExtractAudioFormat')}
            </Label>
            <select
              id="audio-format"
              className="h-11 w-full rounded-md border bg-background px-3 text-base"
              value={audioFormat}
              onChange={(event) => setAudioFormat(event.target.value)}
              disabled={action.busy}
            >
              <option value="mp3">
                {t('videosExtractMP3WorksAlmostEverywhere')}
              </option>
              <option value="aac">
                {t('videosExtractAACCompactHighQuality')}
              </option>
              <option value="wav">
                {t('videosExtractWAVUncompressedLargerFile')}
              </option>
            </select>
            <p className="text-sm text-muted-foreground">
              {t('videosExtractSaveTheAudioTrackWithoutThe')}
            </p>
          </div>
          {noAudio && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('videosExtractThisVideoHasNoAudioTrack')}
            </p>
          )}
          <VideoActionStatus
            label={t('videosExtractExtractingAudio')}
            error={action.error}
            diagnostic={action.diagnostic}
          />
          <Button
            className="min-h-11 w-full sm:w-auto sm:self-end"
            disabled={action.busy || !action.selectedFile || !!noAudio}
            onClick={() =>
              void action.run(async (processor, signal) => ({
                blob: await processor.extractAudio({ audioFormat, signal }),
                filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}.${audioFormat}`,
                details: [
                  message('videosExtractAudio', {
                    audioFormat: audioFormat.toUpperCase(),
                  }),
                ],
              }))
            }
          >
            {action.isProcessing
              ? t('videosExtractExtracting')
              : t('videosExtractExtractAudio')}
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
