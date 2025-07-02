import { createFileRoute } from '@tanstack/react-router'
import { VideoTools } from '../components/VideoTools'
import { ToolSidebar } from '../components/ToolSidebar'

export const Route = createFileRoute('/videos')({
  component: VideoToolsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function VideoToolsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <VideoTools />
      </div>
    </div>
  )
}
