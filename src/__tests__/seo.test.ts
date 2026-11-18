// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { expect, test } from 'vitest'
import { canonicalUrl, homePage } from '@/lib/seo'
import { languagePath, supportedLanguages } from '@/i18n/locales'
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
    const paths = ['/', ...allTools.map((tool) => tool.route)]
    expect(urls).toEqual(
      supportedLanguages.flatMap((language) =>
        paths.map((path) => canonicalUrl(path, language)),
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
      if (tool.route === '/utilities/qr') {
        expect(html).toContain('id="qr-content"')
        expect(html).not.toContain('type="file"')
      } else expect(html).toContain('type="file"')
      expect(html).toMatch(/<fieldset id="workspace-controls" disabled/)
      expect(html).not.toContain('or drop a file here')
      expect(html).not.toContain('or drop files here')
      expect(home).toContain(`href="${tool.route}"`)
      expect(html).not.toContain('name="robots"')
      titles.add(title(html))
      descriptions.add(description(html))
    }
    expect(titles.size).toBe(paths.length)
    expect(descriptions.size).toBe(paths.length)

    for (const language of supportedLanguages.filter(
      (language) => language !== 'en',
    )) {
      const localizedHome = await read(
        `${languagePath(language, '/').slice(1)}.html`,
      )
      expect(localizedHome).toContain(
        `<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">`,
      )
      expect(title(localizedHome)).not.toBe(title(home))
      for (const path of paths) {
        const localized =
          path === '/'
            ? localizedHome
            : await read(`${languagePath(language, path).slice(1)}.html`)
        expect(localized).toContain(
          `rel="canonical" href="${canonicalUrl(path, language)}"`,
        )
        for (const alternate of supportedLanguages) {
          expect(localized).toContain(
            `hrefLang="${alternate}" href="${canonicalUrl(path, alternate)}"`,
          )
        }
        expect(localized).toContain(
          `hrefLang="x-default" href="${canonicalUrl(path, 'en')}"`,
        )
      }
      expect(localizedHome).toContain(
        `href="${languagePath(language, '/pdfs/merge')}"`,
      )
    }

    const notFound = await read('404.html')
    expect(notFound).toContain('name="robots" content="noindex"')
    expect(notFound).not.toContain('rel="canonical"')
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}, 60_000)
