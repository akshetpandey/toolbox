import { useLocale, useTranslator } from '@/i18n/LocaleContext'
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
import { PageHead } from '@/components/PageHead'
import { isToolboxPagePath } from '@/lib/toolPaths'
import { getHomePage, getNotFoundPage } from '@/lib/seo'

export const Route = createRootRoute({
  component: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  const { language } = useLocale()
  const t = useTranslator()
  const page = getNotFoundPage(t)
  return (
    <div className="mx-auto max-w-xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold">{page.heading}</h1>
      <p className="text-muted-foreground">{page.intro}</p>
      <Link key={language} to="/" className="text-primary underline">
        {t('shellBrowseAllTools')}
      </Link>
    </div>
  )
}

function RootDocument() {
  const t = useTranslator()
  const { pathname } = useLocation()
  const hydrated = useHydrated()
  const { language } = useLocale()
  const path = pathname.replace(/\/$/, '') || '/'
  const toolPage = path !== '/' && isToolboxPagePath(path)
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
      {!toolPage && (
        <PageHead
          page={path === '/' ? getHomePage(t, language) : getNotFoundPage(t)}
          t={t}
        />
      )}
      <a href="#main-content" className="skip-link">
        {t('shellSkipToWorkspace')}
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
