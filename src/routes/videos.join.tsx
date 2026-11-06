import { createFileRoute } from '@tanstack/react-router'
import { MediaTool } from '@/components/MediaTool'

export const Route = createFileRoute('/videos/join')({
  component: () => <MediaTool mode="video-join" />,
})
