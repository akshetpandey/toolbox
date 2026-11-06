// @vitest-environment node
import { expect, test, vi } from 'vitest'
import worker from '@/worker'

const origin = 'https://toolbox.computer'

test.each([
  [
    'GET',
    '/Images/ReSiZe?mode=A%2BB&mode=C',
    '/images/resize?mode=A%2BB&mode=C',
  ],
  ['HEAD', '/PDFs/?source=Saved', '/pdfs/merge?source=Saved'],
  ['GET', '/PDFs/SPLIT', '/pdfs/split'],
])('redirects %s %s to %s', async (method, path, target) => {
  const fetchAsset = vi.fn()
  const response = await worker.fetch(new Request(origin + path, { method }), {
    ASSETS: { fetch: fetchAsset },
  })

  expect(response.status).toBe(301)
  expect(response.headers.get('location')).toBe(origin + target)
  expect(fetchAsset).not.toHaveBeenCalled()
})

test.each([
  ['/Images/Unknown', 404],
  ['/images/resize', 200],
  ['/assets/app-A1b2.js', 200],
])('preserves the asset response for %s', async (path, status) => {
  const assetResponse = new Response(null, { status })
  const fetchAsset = vi.fn().mockResolvedValue(assetResponse)
  const request = new Request(origin + path)

  expect(await worker.fetch(request, { ASSETS: { fetch: fetchAsset } })).toBe(
    assetResponse,
  )
  expect(fetchAsset).toHaveBeenCalledExactlyOnceWith(request)
})
