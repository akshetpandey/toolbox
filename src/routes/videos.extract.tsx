import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ResultCard } from '@/components/ResultCard'
import {
  useVideoSettings,
  useVideoAction,
  VideoActionStatus,
} from '@/lib/videoToolsUtils'

export const Route = createFileRoute('/videos/extract')({
  component: VideoExtractComponent,
  head: () => ({
    meta: [
      {
        title:
          'Audio Extractor - Free Browser-Based Audio Extraction | Toolbox',
      },
      {
        name: 'description',
        content:
          'Free, open-source browser-based audio extraction tool. Extract audio from videos in MP3, WAV, or AAC formats. Process videos entirely in your browser with complete privacy.',
      },
      {
        name: 'keywords',
        content:
          'extract audio from video, video to MP3, audio extraction, browser audio converter, privacy-focused',
      },
      {
        property: 'og:title',
        content: 'Audio Extractor - Free Browser-Based Tool',
      },
      {
        property: 'og:description',
        content:
          'Free, open-source browser-based audio extraction. Extract audio from videos in multiple formats.',
      },
    ],
  }),
})

function VideoExtractComponent() {
  const action = useVideoAction(
    'videos.extract',
    'The audio could not be extracted. Check that your video has an audio track or choose another file.',
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="audio-format">Audio format</Label>
        <select
          id="audio-format"
          className="h-11 w-full rounded-md border bg-background px-3 text-base"
          value={audioFormat}
          onChange={(event) => setAudioFormat(event.target.value)}
          disabled={action.busy}
        >
          <option value="mp3">MP3 — works almost everywhere</option>
          <option value="aac">AAC — compact, high quality</option>
          <option value="wav">WAV — uncompressed, larger file</option>
        </select>
        <p className="text-sm text-muted-foreground">
          Save the audio track without the video.
        </p>
      </div>
      {noAudio && (
        <p role="status" className="text-sm text-muted-foreground">
          This video has no audio track. Choose a video with sound to extract
          audio.
        </p>
      )}
      <VideoActionStatus
        label="Extracting audio"
        error={action.error}
        diagnostic={action.diagnostic}
      />
      <Button
        className="min-h-11 w-full sm:w-auto"
        disabled={action.busy || !action.selectedFile || !!noAudio}
        onClick={() =>
          void action.run(async (processor, signal) => ({
            blob: await processor.extractAudio({ audioFormat, signal }),
            filename: `${action.selectedFile!.name.replace(/\.[^/.]+$/, '')}.${audioFormat}`,
            details: [`${audioFormat.toUpperCase()} audio`],
          }))
        }
      >
        {action.isProcessing ? 'Extracting…' : 'Extract audio'}
      </Button>
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
      />
    </div>
  )
}
