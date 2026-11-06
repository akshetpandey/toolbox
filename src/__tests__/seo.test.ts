// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, test } from 'vitest'
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
    expect(home).toContain('id="tool-search"')
    expect(home).toMatch(/<fieldset id="workspace-controls" disabled/)
    const titles = new Set([/<title[^>]*>([^<]+)<\/title>/.exec(home)?.[1]])
    for (const tool of allTools) {
      const html = await read(`${tool.route.slice(1)}.html`)
      expect(html).toContain(
        `rel="canonical" href="https://toolbox.computer${tool.route}"`,
      )
      expect(html).toContain(`>${tool.name}</h1>`)
      expect(html).toContain(tool.instructions)
      expect(html).toContain('type="file"')
      expect(html).toMatch(/<fieldset id="workspace-controls" disabled/)
      expect(html).not.toContain('or drop a file here')
      expect(html).not.toContain('or drop files here')
      expect(home).toContain(`href="${tool.route}"`)
      expect(html).not.toContain('name="robots"')
      titles.add(/<title[^>]*>([^<]+)<\/title>/.exec(html)?.[1])
    }
    expect(titles.has(undefined)).toBe(false)
    expect(titles.size).toBe(urls.length)

    for (const file of ['pdfs/compress.html', 'pdfs/split.html', '404.html']) {
      const html = await read(file)
      expect(html).toContain('name="robots" content="noindex"')
      expect(html).not.toContain('rel="canonical"')
    }
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}, 30_000)
