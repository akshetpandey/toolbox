import { createFileRoute } from '@tanstack/react-router'
import { ArchiveTools } from '@/components/ArchiveTools'
import { ToolSidebar } from '@/components/ToolSidebar'

export const Route = createFileRoute('/archives')({
  component: ArchiveToolsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function ArchiveToolsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <ArchiveTools />
      </div>
    </div>
  )
} 