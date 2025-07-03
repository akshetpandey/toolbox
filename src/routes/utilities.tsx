import { createFileRoute } from '@tanstack/react-router'
import { UtilitiesTools } from '../components/UtilitiesTools'
import { ToolSidebar } from '../components/ToolSidebar'

export const Route = createFileRoute('/utilities')({
  component: UtilitiesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function UtilitiesPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <UtilitiesTools />
      </div>
    </div>
  )
}
