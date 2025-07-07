import { createFileRoute } from '@tanstack/react-router'
import { PDFTools } from '../components/PDFTools'
import { ToolSidebar } from '../components/ToolSidebar'

export const Route = createFileRoute('/pdfs')({
  component: PDFToolsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab as string | undefined,
  }),
})

function PDFToolsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <PDFTools />
      </div>
    </div>
  )
}
