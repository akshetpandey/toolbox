// import * as Sentry from '@sentry/react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { AppProviders, createAppRouter } from './app'

import './styles.css'

const router = createAppRouter()

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

const root = document.getElementById('root')!
if (root.dataset.prerenderPath === router.state.location.pathname) {
  hydrateRoot(
    root,
    <AppProviders>
      <RouterClient router={router} />
    </AppProviders>,
  )
} else {
  // Development and shared fallback pages may serve a different route's HTML.
  document.head
    .querySelectorAll('[data-toolbox-head]')
    .forEach((tag) => tag.remove())
  createRoot(root).render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}
