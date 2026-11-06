import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProcessingProvider } from '@/contexts/ProcessingContext'
import { routeTree } from './routeTree.gen'

export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
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

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <ThemeProvider>
        <ProcessingProvider>{children}</ProcessingProvider>
      </ThemeProvider>
    </StrictMode>
  )
}
