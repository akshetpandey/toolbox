import { message, imageDimensions } from '@/i18n/messages'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'
import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ResultCard } from '@/components/ResultCard'
import { useVideoAction, VideoActionStatus } from '@/lib/videoToolsUtils'
import { formatFileSize, formatDuration } from '@/lib/shared'
import {
  Info,
  Video as VideoIcon,
  Volume2,
  ShieldOff,
  Loader2,
} from 'lucide-react'

export const Route = createFileRoute('/videos/metadata')({
  component: VideoMetadataComponent,
})

function VideoMetadataComponent() {
  const t = useTranslator()
  const action = useVideoAction(
    'videos.metadata',
    message('videosMetadataMetadataCouldNotBeRemovedTry'),
  )
  const { selectedFile, metadata, isProcessing } = action
  const isStrippingMetadata = isProcessing
  const handleStripMetadata = () =>
    action.run(async (processor) => ({
      blob: await processor.stripMetadata(),
      filename: `no-metadata_${selectedFile!.name}`,
      details: [
        message('videosMetadataDescriptiveMetadataRemovedContainerAndCodec'),
      ],
    }))

  if (!selectedFile) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('videosMetadataVideoInformation')}
          </h2>
          <div className="text-sm text-muted-foreground">
            {t('videosMetadataPleaseSelectAVideoFileTo')}
          </div>
        </CardContent>
      </Card>
    )
  }

  const fileMetadata = metadata[selectedFile.name]

  if (!fileMetadata) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">
            {t('videosMetadataVideoInformation')}
          </h2>
          <div className="text-sm text-muted-foreground">
            {t('videosMetadataVideoInformationWillAppearOncePreparation')}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card>
        <CardContent className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-col gap-6">
            <VideoActionStatus
              label={t('videosMetadataRemovingMetadata')}
              cancellable={false}
              error={action.error}
              diagnostic={action.diagnostic}
            />
            <h2 className="text-lg font-semibold">
              {t('videosMetadataVideoInformation')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('videosMetadataViewTheVideoSTechnicalDetailsOr')}
            </p>
            {/* Format Information */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  {t('videosMetadataFormatInformation')}
                </h3>
                <Button
                  onClick={() => void handleStripMetadata()}
                  disabled={action.busy}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isStrippingMetadata ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="h-4 w-4" />
                  )}
                  {isStrippingMetadata
                    ? t('videosMetadataRemovingMetadataText')
                    : t('videosMetadataRemoveMetadata')}
                </Button>
              </div>
              <div className="border-t border-border py-4 flex flex-col gap-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('videosMetadataContainer')}
                    </span>
                    <span className="font-medium">
                      {fileMetadata.format.format_name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('videosMetadataDuration')}
                    </span>
                    <span className="font-medium">
                      {formatDuration(fileMetadata.format.duration)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('videosMetadataFileSize')}
                    </span>
                    <span className="font-medium">
                      {formatFileSize(fileMetadata.format.size, t)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('videosMetadataOverallBitrate')}
                    </span>
                    <span className="font-medium">
                      {fileMetadata.format.bit_rate > 0
                        ? t('videosMetadataKbps', {
                            Math: Math.round(
                              fileMetadata.format.bit_rate / 1000,
                            ),
                          })
                        : t('videosMetadataUnknown')}
                    </span>
                  </div>
                  <div className="flex justify-between col-span-1 md:col-span-2">
                    <span className="text-muted-foreground">
                      {t('videosMetadataStreams')}
                    </span>
                    <span className="font-medium">
                      {t('videosMetadataTotal', {
                        count: fileMetadata.format.nb_streams,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Video Streams */}
            {fileMetadata.video_streams.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <VideoIcon className="h-5 w-5 text-purple-500" />
                  {t('videosMetadataVideoStreams', {
                    count: fileMetadata.video_streams.length,
                  })}
                </h3>
                <div className="flex flex-col gap-3">
                  {fileMetadata.video_streams.map((stream) => (
                    <div
                      key={stream.index}
                      className="border-t border-border py-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {t('videosMetadataStream', { number: stream.index })}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {stream.codec_long_name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataCodec')}
                          </span>
                          <span className="font-medium">
                            {stream.codec_name.toUpperCase()}
                            {stream.profile && ` (${stream.profile})`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataResolution')}
                          </span>
                          <span className="font-medium">
                            {t('mediaDimensions', {
                              dimensions: imageDimensions(
                                stream.width,
                                stream.height,
                              ),
                            })}
                          </span>
                        </div>
                        {stream.display_aspect_ratio && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataAspectRatio')}
                            </span>
                            <span className="font-medium">
                              {stream.display_aspect_ratio}
                            </span>
                          </div>
                        )}
                        {stream.fps && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataFrameRate')}
                            </span>
                            <span className="font-medium">
                              {stream.fps} fps
                            </span>
                          </div>
                        )}
                        {stream.pix_fmt && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataPixelFormat')}
                            </span>
                            <span className="font-medium">
                              {stream.pix_fmt}
                            </span>
                          </div>
                        )}
                        {stream.color_space && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataColorSpace')}
                            </span>
                            <span className="font-medium">
                              {stream.color_space}
                            </span>
                          </div>
                        )}
                        {stream.color_range && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataColorRange')}
                            </span>
                            <span className="font-medium">
                              {stream.color_range}
                            </span>
                          </div>
                        )}
                        {stream.color_transfer && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('videosMetadataTransfer')}
                            </span>
                            <span className="font-medium">
                              {stream.color_transfer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Streams */}
            {fileMetadata.audio_streams.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-green-500" />
                  {t('videosMetadataAudioStreams', {
                    count: fileMetadata.audio_streams.length,
                  })}
                </h3>
                <div className="flex flex-col gap-3">
                  {fileMetadata.audio_streams.map((stream) => (
                    <div
                      key={stream.index}
                      className="border-t border-border py-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="text-xs">
                          {t('videosMetadataStream', { number: stream.index })}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {stream.codec_long_name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataCodec')}
                          </span>
                          <span className="font-medium">
                            {stream.codec_name.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataSampleRate')}
                          </span>
                          <span className="font-medium">
                            {stream.sample_rate} Hz
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataChannels')}
                          </span>
                          <span className="font-medium">
                            {stream.channels}
                            {stream.channel_layout &&
                              ` (${stream.channel_layout})`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {t('videosMetadataBitrate')}
                          </span>
                          <span className="font-medium">
                            {stream.bit_rate && stream.bit_rate > 0
                              ? t('videosMetadataKbps', {
                                  Math: Math.round(stream.bit_rate / 1000),
                                })
                              : t('videosMetadataUnknown')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <ResultCard
        result={action.result}
        onReset={action.busy ? undefined : action.clearSelectedFile}
      />
    </div>
  )
}
