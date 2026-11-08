// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, test } from 'vitest'
import { homePage } from '@/lib/seo'
import { allTools } from '@/lib/tools'
import { pandocWasmPlugin } from '../../vite-plugin-pandoc-wasm.ts'
import { seoPagesPlugin } from '../../vite-plugin-seo-pages.ts'

test('the build publishes the React workspace for each available tool', async () => {
  const outDir = await mkdtemp(join(tmpdir(), 'toolbox-seo-'))
  const root = fileURLToPath(new URL('../../', import.meta.url))
  try {
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      resolve: { tsconfigPaths: true },
      plugins: [pandocWasmPlugin(), seoPagesPlugin()],
      build: { outDir, reportCompressedSize: false },
    })
    const read = (file: string) => readFile(join(outDir, file), 'utf8')
    const sitemap = await read('sitemap.xml')
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1],
    )
    expect(urls).toEqual(
      ['/', ...allTools.map((tool) => tool.route)].map(
        (path) => `https://toolbox.computer${path}`,
      ),
    )

    const home = await read('index.html')
    expect(home).toContain('rel="canonical" href="https://toolbox.computer/"')
    expect(home).toContain(`>${homePage.heading}</h1>`)
    expect(home).toContain('id="tool-search"')
    expect(home).toMatch(/<fieldset id="workspace-controls" disabled/)
    const title = (html: string) =>
      /<title[^>]*>([^<]+)<\/title>/.exec(html)?.[1]
    const description = (html: string) =>
      /<meta [^>]*name="description" content="([^"]+)"/.exec(html)?.[1]
    expect(title(home)).toBe(homePage.title)
    expect(description(home)).toBe(homePage.description)
    const titles = new Set([title(home)])
    const descriptions = new Set([description(home)])
    for (const tool of allTools) {
      const html = await read(`${tool.route.slice(1)}.html`)
      expect(html).toContain(
        `rel="canonical" href="https://toolbox.computer${tool.route}"`,
      )
      expect(html).toContain(`>${tool.name}</h1>`)
      expect(html.slice(html.indexOf('<body>'))).toContain(tool.instructions)
      expect(title(html)).toBe(`${tool.pageTitle} | Toolbox`)
      expect(description(html)).toBe(tool.instructions)
      expect(html).toContain('type="file"')
      expect(html).toMatch(/<fieldset id="workspace-controls" disabled/)
      expect(html).not.toContain('or drop a file here')
      expect(html).not.toContain('or drop files here')
      expect(home).toContain(`href="${tool.route}"`)
      expect(html).not.toContain('name="robots"')
      titles.add(title(html))
      descriptions.add(description(html))
    }
    expect(titles.size).toBe(urls.length)
    expect(descriptions.size).toBe(urls.length)

    const notFound = await read('404.html')
    expect(notFound).toContain('name="robots" content="noindex"')
    expect(notFound).not.toContain('rel="canonical"')
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}, 30_000)
