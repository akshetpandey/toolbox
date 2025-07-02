import { createFileRoute } from '@tanstack/react-router'
import { ToolSidebar } from '../components/ToolSidebar'
import { MainContent } from '../components/MainContent'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ToolSidebar />
      <div className="flex-1 overflow-hidden">
        <MainContent />
      </div>
    </div>
  )
}
