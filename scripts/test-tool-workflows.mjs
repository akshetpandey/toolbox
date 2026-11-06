import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
import { allTools } from '../src/lib/tools.ts'
import { checkToolBundles } from './check-tool-bundles.mjs'
import { workflows } from './tool-workflow-cases.mjs'
import { workflowFixtures } from './tool-workflow-fixtures.mjs'

const { values } = parseArgs({
  options: {
    preview: { type: 'boolean' },
    screenshots: { type: 'string' },
    only: { type: 'string', multiple: true },
  },
})
const screenshots = values.screenshots ? resolve(values.screenshots) : null
const profiles = screenshots
  ? [
      { name: 'desktop', viewport: { width: 1440, height: 1000 } },
      {
        name: 'mobile',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    ]
  : [{ name: 'chromium', viewport: { width: 1440, height: 1000 } }]

assert.deepEqual(
  Object.keys(workflows).sort(),
  allTools.map(({ route }) => route).sort(),
  'Every catalog tool needs an output or inspection workflow',
)
const selected = allTools.filter(
  ({ route }) =>
    !values.only || values.only.some((part) => route.includes(part)),
)
assert(selected.length > 0, 'No tool paths matched --only')

const server = spawn(
  'pnpm',
  [values.preview ? 'serve' : 'dev', '--host', '127.0.0.1', '--port', '0'],
  {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)

let browser
const results = []
try {
  const origin = await new Promise((resolve, reject) => {
    let log = ''
    const timeout = setTimeout(
      () => reject(new Error(`Toolbox server did not start\n${log}`)),
      30_000,
    )
    const failed = (error) => {
      clearTimeout(timeout)
      reject(error)
    }
    const collect = (data) => {
      log += data.toString()
      const local = /Local:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(log)
      if (local) {
        clearTimeout(timeout)
        resolve(local[1])
      }
    }
    server.on('error', failed)
    server.on('exit', (code) =>
      failed(new Error(`Toolbox server exited (${code})\n${log}`)),
    )
    server.stdout.on('data', collect)
    server.stderr.on('data', collect)
  })
  browser = await chromium.launch()
  if (values.preview) await checkToolBundles(browser, origin)
  const fixturePage = await browser.newPage()
  const fixtures = await workflowFixtures(fixturePage)
  await fixturePage.close()

  for (const { name: layout, ...profile } of profiles) {
    const folder = screenshots && join(screenshots, layout)
    if (folder) await mkdir(folder, { recursive: true })
    const context = await browser.newContext({
      ...profile,
      acceptDownloads: true,
    })
    const unexpectedRequests = []
    await context.route(/^https?:/, async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      // The existing Typst compiler downloads static font files. All user data
      // must stay in the browser and every other request must use the app origin.
      const typstFont =
        url.origin === 'https://cdn.jsdelivr.net' &&
        /^\/gh\/typst\/typst(?:-dev)?-assets@[^/]+\/files\/fonts\//.test(
          url.pathname,
        )
      if (
        ['GET', 'HEAD'].includes(request.method()) &&
        (url.origin === origin || typstFont)
      ) {
        await route.continue()
      } else {
        unexpectedRequests.push(`${request.method()} ${url.href}`)
        await route.abort()
      }
    })

    if (folder && !values.only) {
      const page = await context.newPage()
      await page.goto(origin)
      await page.getByRole('searchbox').waitFor()
      await page.screenshot({
        path: join(folder, 'home.png'),
        animations: 'disabled',
      })
      if (layout === 'mobile') {
        await page.getByRole('button', { name: 'Tools', exact: true }).click()
        await page.getByRole('dialog').waitFor()
        await page.screenshot({
          path: join(folder, 'tools-menu.png'),
          animations: 'disabled',
        })
      }
      await page.close()
    }

    for (const { name, route } of selected) {
      const page = await context.newPage()
      page.setDefaultTimeout(20_000)
      const prefix = route.slice(1).replaceAll('/', '-')
      const errors = []
      const diagnostics = []
      const requestStart = unexpectedRequests.length
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
          diagnostics.push(message.text())
      })
      const capture = async (state, locator) => {
        if (!folder) return
        if (locator && state === 'edit') {
          await locator.evaluate((element) =>
            element.scrollIntoView({ block: 'start' }),
          )
        } else if (locator) await locator.scrollIntoViewIfNeeded()
        await page.screenshot({
          path: join(folder, `${prefix}-${state}.png`),
          animations: 'disabled',
        })
      }

      try {
        await page.goto(origin + route)
        await page.getByRole('heading', { name, level: 1 }).waitFor()
        await workflows[route](page, fixtures, capture)
        assert.deepEqual(
          unexpectedRequests.slice(requestStart),
          [],
          'Unexpected network requests',
        )
        assert.deepEqual(errors, [], 'Uncaught browser errors')
        const horizontalOverflow = await page.evaluate(() => {
          const root = document.querySelector('main')
          return Math.max(
            document.documentElement.scrollWidth - innerWidth,
            root.scrollWidth - root.clientWidth,
          )
        })
        assert(
          horizontalOverflow <= 1,
          `${horizontalOverflow}px of horizontal overflow`,
        )
        if (folder) {
          const result = page.locator('.result-card').first()
          await capture('result', (await result.isVisible()) ? result : null)
        }
        results.push({ layout, route, name, passed: true })
        console.log(`PASS ${layout} ${route}`)
      } catch (error) {
        const alerts = await page
          .getByRole('alert')
          .allTextContents()
          .catch(() => [])
        const message = [
          error.message,
          ...alerts,
          ...errors,
          ...diagnostics.slice(-5),
        ]
          .filter(Boolean)
          .join('\n')
        results.push({ layout, route, name, passed: false, message })
        console.error(`FAIL ${layout} ${route}\n${message}`)
        await capture('failure').catch(() => undefined)
      } finally {
        await page.close()
      }
    }
    await context.close()
  }
} finally {
  await browser?.close()
  if (server.pid && server.exitCode === null) {
    if (process.platform === 'win32') server.kill('SIGTERM')
    else process.kill(-server.pid, 'SIGTERM')
  }
}
if (screenshots)
  await writeFile(
    join(screenshots, 'results.json'),
    JSON.stringify(results, null, 2),
  )
const failures = results.filter(({ passed }) => !passed).length
console.log(
  `\n${results.length - failures}/${results.length} browser workflows passed`,
)
if (failures) process.exitCode = 1
