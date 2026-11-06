import { createFileRoute } from '@tanstack/react-router'
import { MediaTool } from '@/components/MediaTool'

export const Route = createFileRoute('/audio/convert')({
  component: () => <MediaTool mode="audio-convert" />,
})
