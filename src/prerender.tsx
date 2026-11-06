import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { AppProviders, createAppRouter } from './app'
import { notFoundPage, siteUrl } from './lib/seo'

export async function renderPage(path: string) {
  const handleRequest = createRequestHandler({
    createRouter: createAppRouter,
    request: new Request(new URL(path, siteUrl)),
  })
  const response = await handleRequest(({ router, responseHeaders }) =>
    renderRouterToString({
      router,
      responseHeaders,
      children: (
        <div id="root" data-prerender-path={path}>
          <AppProviders>
            <RouterServer router={router} />
          </AppProviders>
        </div>
      ),
    }),
  )
  const html = (await response.text()).replace(/^<!doctype html>/i, '')
  const expectedStatus = path === notFoundPage.path ? 404 : 200
  if (response.status !== expectedStatus) {
    throw new Error(`Failed to prerender ${path}: HTTP ${response.status}`)
  }
  // React hoists the route's document metadata before the workspace markup.
  const bodyStart = html.indexOf('<div id="root"')
  if (bodyStart === -1)
    throw new Error(`Missing rendered workspace for ${path}`)
  return { head: html.slice(0, bodyStart), body: html.slice(bodyStart) }
}
