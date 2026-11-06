import {
  Outlet,
  Scripts,
  createRootRoute,
  Link,
  useHydrated,
  useLocation,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { ToolSidebar } from '@/components/ToolSidebar'
import { getPage, notFoundPage, pageMeta } from '@/lib/seo'

export const Route = createRootRoute({
  component: RootDocument,
  notFoundComponent: () => {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold">{notFoundPage.heading}</h1>
        <p className="text-muted-foreground">{notFoundPage.intro}</p>
        <Link to="/" className="text-primary underline">
          Browse all tools
        </Link>
      </div>
    )
  },
})

function RootDocument() {
  const { pathname } = useLocation()
  const hydrated = useHydrated()
  const page = getPage(pathname)
  const previousPath = useRef(pathname)
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    // Wait for a mobile dialog to close before moving focus into the new task.
    const frame = requestAnimationFrame(() =>
      document.getElementById('main-content')?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [pathname])
  return (
    <>
      <title data-toolbox-head="">{page.title}</title>
      {pageMeta(page).map((meta) => (
        <meta key={meta.name ?? meta.property} data-toolbox-head="" {...meta} />
      ))}
      {page.canonical && (
        <link rel="canonical" href={page.canonical} data-toolbox-head="" />
      )}
      <a href="#main-content" className="skip-link">
        Skip to workspace
      </a>
      <fieldset
        id="workspace-controls"
        disabled={!hydrated}
        className="min-w-0 border-0 p-0"
      >
        <div className="flex h-dvh overflow-hidden bg-background">
          <ToolSidebar />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-hidden pt-16 outline-none xl:pt-0"
          >
            <Outlet />
          </main>
        </div>
      </fieldset>
      <Scripts />
    </>
  )
}
