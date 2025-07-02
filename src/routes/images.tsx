import { createFileRoute } from '@tanstack/react-router'
import { ImageTools } from '../components/ImageTools'
import { ToolSidebar } from '../components/ToolSidebar'

export const Route = createFileRoute('/images')({
  component: ImageToolsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function ImageToolsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <ImageTools />
      </div>
    </div>
  )
} 