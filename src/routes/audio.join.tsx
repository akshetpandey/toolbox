import { createFileRoute } from '@tanstack/react-router'
import { MediaTool } from '@/components/MediaTool'

export const Route = createFileRoute('/audio/join')({
  component: () => <MediaTool mode="audio-join" />,
})
