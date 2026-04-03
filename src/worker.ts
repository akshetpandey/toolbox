/**
 * Cloudflare Worker that serves static assets from dist/.
 *
 * WASM files are pre-compressed with gzip during the build step
 * (scripts/compress-wasm.mjs). This worker intercepts those requests
 * and sets the correct Content-Encoding so browsers decompress them
 * transparently. All other requests are passed through unchanged.
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response: Response = await env.ASSETS.fetch(request)

    // WASM files are stored pre-gzipped — tell the browser to decompress.
    const url = new URL(request.url)
    if (url.pathname.endsWith('.wasm')) {
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
