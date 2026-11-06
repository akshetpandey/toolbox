import { createFileRoute } from '@tanstack/react-router'
import { MediaTool } from '@/components/MediaTool'

export const Route = createFileRoute('/audio/trim')({
  component: () => <MediaTool mode="audio-trim" />,
})
