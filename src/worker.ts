/**
 * Cloudflare Worker that serves static assets from dist/.
 *
 * Redirect mixed-case app paths to their canonical URLs.
 *
 * WASM files are pre-compressed with gzip during the build step
 * (scripts/compress-wasm.mjs). This worker intercepts those requests
 * and sets the correct Content-Encoding so browsers decompress them
 * transparently. All other requests are passed through unchanged.
 */

import { categoryRedirects, toolPaths } from './lib/toolPaths.ts'

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const canonicalPaths = new Map<string, string>([
  ...Object.values(toolPaths).map((path) => [path, path] as const),
  ...Object.entries(categoryRedirects),
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const lowercasePath = url.pathname.toLowerCase()
    if (
      url.pathname !== lowercasePath &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      const canonical = canonicalPaths.get(lowercasePath.replace(/\/$/, ''))
      if (canonical) {
        url.pathname = canonical
        return Response.redirect(url, 301)
      }
    }

    const response: Response = await env.ASSETS.fetch(request)

    // WASM files are stored pre-gzipped — tell the browser to decompress.
    if (url.pathname.endsWith('.wasm') && response.ok) {
      const headers = new Headers(response.headers)
      headers.set('Content-Encoding', 'gzip')
      headers.set('Content-Type', 'application/wasm')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
        // @ts-expect-error — Cloudflare Workers API: prevents the runtime
        // from double-compressing the already-gzipped body.
        encodeBody: 'manual',
      })
    }

    return response
  },
}
