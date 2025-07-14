import { Outlet, Scripts, createRootRoute, Link } from '@tanstack/react-router'
import { ToolSidebar } from '@/components/ToolSidebar'

export const Route = createRootRoute({
  component: RootDocument,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})

function RootDocument() {
  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        <ToolSidebar />
        <div className="flex-1 overflow-hidden ml-16 lg:ml-0">
          <Outlet />
        </div>
      </div>
      <Scripts />
    </>
  )
}
