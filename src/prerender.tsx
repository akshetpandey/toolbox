import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { AppProviders, createAppRouter } from './app'
import { notFoundPath, siteUrl } from './lib/seo'
import { loadTranslator } from './i18n/catalogs'
import { splitLanguagePath } from './i18n/locales'

export async function renderPage(path: string) {
  const { language } = splitLanguagePath(path)
  const translate = await loadTranslator(language)
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
          <AppProviders router={router}>
            <RouterServer router={router} />
          </AppProviders>
        </div>
      ),
    }),
  )
  const html = (await response.text()).replace(/^<!doctype html>/i, '')
  const expectedStatus = path === notFoundPath ? 404 : 200
  if (response.status !== expectedStatus) {
    throw new Error(`Failed to prerender ${path}: HTTP ${response.status}`)
  }
  // React hoists the route's document metadata before the workspace markup.
  const bodyStart = html.indexOf('<div id="root"')
  if (bodyStart === -1)
    throw new Error(`Missing rendered workspace for ${path}`)
  return {
    head: html.slice(0, bodyStart),
    body: html.slice(bodyStart),
    noscript: translate('noscriptEnableJavaScript'),
  }
}
