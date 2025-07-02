import { Outlet, Scripts, createRootRoute, Link } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <RootDocument>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
      <Scripts />
    </RootDocument>
  ),
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
