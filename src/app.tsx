import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { routeTree } from './routeTree.gen'
import { LocaleProvider } from '@/i18n/LocaleContext'
import { languagePath, splitLanguagePath } from '@/i18n/locales'
import type { Language } from '@/i18n/locales'

export function createAppRouter() {
  // Route matches stay language-neutral so switching locale retains the workspace.
  let language: Language = 'en'
  return createRouter({
    rewrite: {
      input: ({ url }) => {
        const locale = splitLanguagePath(url.pathname)
        language = locale.language
        url.pathname = locale.path
        return url
      },
      output: ({ url }) => {
        url.pathname = languagePath(language, url.pathname)
        return url
      },
    },
    routeTree,
    defaultPreload: false,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })
}

type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}

export function AppProviders({
  router,
  children,
}: {
  router: AppRouter
  children: ReactNode
}) {
  return (
    <StrictMode>
      <LocaleProvider history={router.history}>
        <ThemeProvider>
          <ProcessingProvider>{children}</ProcessingProvider>
        </ThemeProvider>
      </LocaleProvider>
    </StrictMode>
  )
}
