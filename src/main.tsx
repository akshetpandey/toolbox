// import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProcessingProvider } from '@/contexts/ProcessingContext'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

import './styles.css'

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Sentry.init({
//   dsn: 'https://38d29462f035766236e6351eab93e25d@o4509596293726208.ingest.us.sentry.io/4509596298575872',
//   dataCollection: {
//     userInfo: false,
//     cookies: false,
//     httpHeaders: false,
//     httpBodies: [],
//     urlQueryParams: false,
//     genAI: { inputs: false, outputs: false },
//     databaseQueryData: false,
//     queues: false,
//     graphQL: { document: false, variables: false },
//   },
//   integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
//   // Setting a sample rate is required for sending performance data.
//   // We recommend adjusting this value in production, or using tracesSampler
//   // for finer control.
//   tracesSampleRate: 1.0,
// })

// Render the app
// The build serves introductory content and metadata before React loads.
// React replaces the introduction and owns the head during navigation.
document.head
  .querySelectorAll('[data-static-seo]')
  .forEach((tag) => tag.remove())
const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <StrictMode>
    <ThemeProvider>
      <ProcessingProvider>
        <RouterProvider router={router} />
      </ProcessingProvider>
    </ThemeProvider>
  </StrictMode>,
)
