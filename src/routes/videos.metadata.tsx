import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useVideoTools } from '@/contexts/VideoToolsContext'
import { formatFileSize, formatDuration } from '@/lib/shared'
import { Info, Video as VideoIcon, Volume2 } from 'lucide-react'

export const Route = createFileRoute('/videos/metadata')({
  component: VideoMetadataComponent,
})

function VideoMetadataComponent() {
  const { selectedFile, metadata } = useVideoTools()

  if (!selectedFile) {
    return (
      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Please select a video file to view its metadata
          </div>
        </CardContent>
      </Card>
    )
  }

  const fileMetadata = metadata[selectedFile.name]

  if (!fileMetadata) {
    return (
      <Card className="glass-card border-0">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Extracting metadata...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-0">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6">
          {/* Format Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Format Information
            </h3>
            <div className="bg-muted/50 p-4 rounded-lg flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Container:</span>
                  <span className="font-medium">
                    {fileMetadata.format.format_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {formatDuration(fileMetadata.format.duration)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">File Size:</span>
                  <span className="font-medium">
                    {formatFileSize(fileMetadata.format.size)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Overall Bitrate:
                  </span>
                  <span className="font-medium">
                    {fileMetadata.format.bit_rate > 0
                      ? `${Math.round(fileMetadata.format.bit_rate / 1000)} kbps`
                      : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Streams:</span>
                  <span className="font-medium">
                    {fileMetadata.format.nb_streams} total
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
                Video Streams ({fileMetadata.video_streams.length})
              </h3>
              <div className="flex flex-col gap-3">
                {fileMetadata.video_streams.map((stream) => (
                  <div
                    key={stream.index}
                    className="bg-muted/50 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Stream #{stream.index}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stream.codec_long_name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Codec:</span>
                        <span className="font-medium">
                          {stream.codec_name.toUpperCase()}
                          {stream.profile && ` (${stream.profile})`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Resolution:
                        </span>
                        <span className="font-medium">
                          {stream.width} × {stream.height}
                        </span>
                      </div>
                      {stream.display_aspect_ratio && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Aspect Ratio:
                          </span>
                          <span className="font-medium">
                            {stream.display_aspect_ratio}
                          </span>
                        </div>
                      )}
                      {stream.fps && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Frame Rate:
                          </span>
                          <span className="font-medium">{stream.fps} fps</span>
                        </div>
                      )}
                      {stream.pix_fmt && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Pixel Format:
                          </span>
                          <span className="font-medium">{stream.pix_fmt}</span>
                        </div>
                      )}
                      {stream.color_space && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Color Space:
                          </span>
                          <span className="font-medium">
                            {stream.color_space}
                          </span>
                        </div>
                      )}
                      {stream.color_range && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Color Range:
                          </span>
                          <span className="font-medium">
                            {stream.color_range}
                          </span>
                        </div>
                      )}
                      {stream.color_transfer && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Transfer:
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
                Audio Streams ({fileMetadata.audio_streams.length})
              </h3>
              <div className="flex flex-col gap-3">
                {fileMetadata.audio_streams.map((stream) => (
                  <div
                    key={stream.index}
                    className="bg-muted/50 p-4 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Stream #{stream.index}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stream.codec_long_name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Codec:</span>
                        <span className="font-medium">
                          {stream.codec_name.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Sample Rate:
                        </span>
                        <span className="font-medium">
                          {stream.sample_rate} Hz
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Channels:</span>
                        <span className="font-medium">
                          {stream.channels}
                          {stream.channel_layout &&
                            ` (${stream.channel_layout})`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bitrate:</span>
                        <span className="font-medium">
                          {stream.bit_rate && stream.bit_rate > 0
                            ? `${Math.round(stream.bit_rate / 1000)} kbps`
                            : 'Unknown'}
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
  )
}
