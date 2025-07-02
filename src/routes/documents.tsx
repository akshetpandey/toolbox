import { createFileRoute } from '@tanstack/react-router'
import { DocumentTools } from '../components/DocumentTools'
import { ToolSidebar } from '../components/ToolSidebar'

export const Route = createFileRoute('/documents')({
  component: DocumentToolsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function DocumentToolsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <DocumentTools />
      </div>
    </div>
  )
}
