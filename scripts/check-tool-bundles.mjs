import assert from 'node:assert/strict'
import { allTools } from '../src/lib/tools.ts'

export async function checkToolBundles(browser, origin) {
  const response = await fetch(`${origin}/tool-engine-prefetch.json`)
  assert(response.ok, 'Production build must emit its engine manifest')
  const manifest = await response.json()
  assert.deepEqual(
    Object.keys(manifest).sort(),
    allTools.map(({ route }) => route).sort(),
  )
  const engines = new Set(Object.values(manifest).flat())
  assert(Object.values(manifest).every((assets) => assets.length > 0))

  const context = await browser.newContext()
  try {
    await context.addInitScript(() => {
      globalThis.engineInitializations = []
      for (const name of [
        'instantiate',
        'instantiateStreaming',
        'compile',
        'compileStreaming',
      ]) {
        WebAssembly[name] = new Proxy(WebAssembly[name], {
          apply(target, receiver, args) {
            globalThis.engineInitializations.push(name)
            return Reflect.apply(target, receiver, args)
          },
        })
      }
      globalThis.Worker = new Proxy(Worker, {
        construct(target, args, constructor) {
          globalThis.engineInitializations.push('worker')
          return Reflect.construct(target, args, constructor)
        },
      })
    })
    const page = await context.newPage()
    const requested = []
    page.on('request', (request) =>
      requested.push(new URL(request.url()).pathname.slice(1)),
    )
    await page.goto(origin)
    await page.locator('#workspace-controls:not([disabled])').waitFor()
    const search = page.getByRole('searchbox')
    const searchChunk = /\/toolSearch-[^/]+\.js$/u
    assert(
      !requested.some((asset) => searchChunk.test(asset)),
      'Homepage should defer fuzzy search until the search field is used',
    )
    const homepageRequests = requested.filter((asset) =>
      /\.m?js$/u.test(asset),
    ).length
    assert(
      homepageRequests > 0 && homepageRequests <= 4,
      `Homepage should load at most 4 JavaScript files; got ${homepageRequests}`,
    )
    const homepageJS = await page.evaluate(() => {
      const sizes = new Map()
      for (const entry of performance.getEntriesByType('resource')) {
        if (!/\.m?js$/u.test(new URL(entry.name).pathname)) continue
        sizes.set(
          entry.name,
          Math.max(sizes.get(entry.name) ?? 0, entry.encodedBodySize),
        )
      }
      return [...sizes.values()].reduce((total, size) => total + size, 0)
    })
    assert(
      homepageJS > 0 && homepageJS < 121 * 1024,
      `Homepage JS should stay below 121 KiB compressed; got ${homepageJS} bytes`,
    )
    await search.fill('trim video')
    const videoLink = page
      .getByRole('link', { name: 'Trim video', exact: true })
      .first()
    await videoLink.hover()
    assert(
      requested.some((asset) => searchChunk.test(asset)),
      'Using search should load its separate JavaScript chunk',
    )
    // Intent preloading would schedule work after hovering, even without a click.
    await page.waitForTimeout(300)
    assert(
      !requested.some(
        (asset) =>
          engines.has(asset) ||
          asset === 'tool-engine-prefetch.json' ||
          /\/videos(?:\.trim)?-[^/]+\.js$/u.test(asset),
      ),
      'Homepage must not fetch tool code or processing engines on hover',
    )

    // Capture the actual browser request even if its download is still in
    // flight when the controls appear. No worker should start at this point.
    const wasm = 'ffmpeg-core/ffmpeg-core.wasm'
    const prefetched = page.waitForRequest((request) =>
      request.url().endsWith(`/${wasm}`),
    )
    await videoLink.click()
    await page.getByRole('heading', { name: 'Trim video', level: 1 }).waitFor()
    await page
      .locator(`link[rel=prefetch][href$="/${wasm}"]`)
      .waitFor({ state: 'attached' })
    assert.match(
      (await (await prefetched).allHeaders())['sec-purpose'] ?? '',
      /prefetch/,
    )
    const hints = await page
      .locator('link[rel=prefetch]')
      .evaluateAll((links) =>
        links.map((link) => ({
          file: new URL(link.href).pathname.slice(1),
          priority: link.fetchPriority,
        })),
      )
    assert(hints.some(({ file }) => file.endsWith('.js')))
    assert(
      hints.every(
        ({ file, priority }) =>
          manifest['/videos/trim'].includes(file) && priority === 'low',
      ),
    )
    assert.deepEqual(
      await page.evaluate(() => globalThis.engineInitializations),
      [],
    )
    await page.close()

    const saver = await context.newPage()
    await saver.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
      })
    })
    const dataSaverRequests = []
    saver.on('request', (request) =>
      dataSaverRequests.push(new URL(request.url()).pathname.slice(1)),
    )
    await saver.goto(`${origin}/office-documents/convert`)
    await saver
      .getByRole('heading', {
        name: allTools.find(
          ({ route }) => route === '/office-documents/convert',
        ).name,
        level: 1,
      })
      .waitFor()
    await saver.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    )
    assert.equal(await saver.locator('link[rel=prefetch]').count(), 0)
    assert(
      !dataSaverRequests.some(
        (asset) => engines.has(asset) || asset === 'tool-engine-prefetch.json',
      ),
    )
    assert.deepEqual(
      await saver.evaluate(() => globalThis.engineInitializations),
      [],
    )
    console.log(
      `PASS production bundles: ${homepageRequests} homepage JS requests, ${(homepageJS / 1024).toFixed(1)} KiB compressed, route-only hints, lazy initialization, and data saver`,
    )
  } finally {
    await context.close()
  }
}
