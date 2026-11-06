// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { expect, test } from 'vitest'
import { allTools } from '@/lib/tools'
import { seoPagesPlugin } from '../../vite-plugin-seo-pages.ts'

test('the build publishes crawlable HTML for exactly the available tools', async () => {
  const root = await mkdtemp(join(tmpdir(), 'toolbox-seo-'))
  try {
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
    )
    await build({
      root,
      configFile: false,
      logLevel: 'silent',
      plugins: [seoPagesPlugin()],
    })
    const read = (file: string) => readFile(join(root, 'dist', file), 'utf8')
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
    const titles = new Set([
      /<title data-static-seo>([^<]+)<\/title>/.exec(home)?.[1],
    ])
    for (const tool of allTools) {
      const html = await read(`${tool.route.slice(1)}.html`)
      expect(html).toContain(
        `rel="canonical" href="https://toolbox.computer${tool.route}"`,
      )
      expect(html).toContain(`>${tool.name}</h1>`)
      expect(html).toContain(tool.instructions)
      expect(home).toContain(`href="${tool.route}"`)
      expect(html).not.toContain('name="robots"')
      titles.add(/<title data-static-seo>([^<]+)<\/title>/.exec(html)?.[1])
    }
    expect(titles.has(undefined)).toBe(false)
    expect(titles.size).toBe(urls.length)

    for (const file of ['pdfs/compress.html', 'pdfs/split.html', '404.html']) {
      const html = await read(file)
      expect(html).toContain('name="robots" content="noindex"')
      expect(html).not.toContain('rel="canonical"')
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
