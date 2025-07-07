import { createFileRoute } from '@tanstack/react-router'
import { OfficeTools } from '@/components/OfficeTools'
import { ToolSidebar } from '@/components/ToolSidebar'

export const Route = createFileRoute('/office-documents')({
  component: OfficeDocumentsPage,
})

function OfficeDocumentsPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <OfficeTools />
      </div>
    </div>
  )
}
