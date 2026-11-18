import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import type { Plugin } from 'vite'
import { canonicalUrl, notFoundPath } from './src/lib/seo.ts'
import {
  languageDirection,
  languagePath,
  supportedLanguages,
} from './src/i18n/locales.ts'
import type { Language } from './src/i18n/locales.ts'
import { english } from './src/i18n/messages.ts'
import { categoryRedirects } from './src/lib/toolPaths.ts'
import { allTools } from './src/lib/tools.ts'

const indexedPaths = ['/', ...allTools.map((tool) => tool.route)]

const indexedPages = supportedLanguages.flatMap((language) =>
  indexedPaths.map((toolPath) => ({
    path: languagePath(language, toolPath),
    toolPath,
    language,
  })),
)
const pages = [
  ...indexedPages,
  { path: notFoundPath, toolPath: notFoundPath, language: 'en' as Language },
]

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function renderPages(root: string, template: string) {
  const rootPlaceholder = '<div id="root"></div>'
  if (!template.includes(rootPlaceholder) || !template.includes('</head>')) {
    throw new Error(
      'The Vite HTML template must contain a head and an empty root',
    )
  }
  // Keep the Node-only render bundle out of the deployed assets and near its dependencies.
  const outDir = await mkdtemp(
    join(root, 'node_modules', '.toolbox-prerender-'),
  )
  try {
    await build({
      configFile: false,
      root,
      resolve: { tsconfigPaths: true },
      logLevel: 'warn',
      build: {
        ssr: 'src/prerender.tsx',
        outDir,
        copyPublicDir: false,
        rolldownOptions: {
          output: {
            entryFileNames: '[name].mjs',
            chunkFileNames: '[name]-[hash].mjs',
          },
        },
      },
    })
    const { renderPage } = (await import(
      pathToFileURL(join(outDir, 'prerender.mjs')).href
    )) as typeof import('./src/prerender.tsx')

    const results = []
    for (const { path, language } of pages) {
      const { head, body, noscript } = await renderPage(path)
      const html = template
        .replace(
          '<html lang="en">',
          `<html lang="${language}" dir="${languageDirection(language)}">`,
        )
        .replace('<!-- toolbox-noscript -->', () => escapeHtml(noscript))
        .replace('</head>', () => `    ${head}\n  </head>`)
        .replace(rootPlaceholder, () => body)
      results.push({ path, html })
    }
    return results
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}

/** Emit crawlable landing pages around Vite's compiled client entry point. */
export function seoPagesPlugin(): Plugin {
  let root: string
  return {
    name: 'seo-pages',
    transformIndexHtml(html, context) {
      if (context.server)
        return html.replace('<!-- toolbox-noscript -->', () =>
          escapeHtml(english('noscriptEnableJavaScript')),
        )
    },
    configResolved(config) {
      root = config.root
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset' || typeof index.source !== 'string') {
          throw new Error('Expected Vite to emit index.html before SEO pages')
        }
        for (const { path, html } of await renderPages(root, index.source)) {
          if (path === '/') index.source = html
          else
            this.emitFile({
              type: 'asset',
              fileName: `${path.slice(1)}.html`,
              source: html,
            })
        }

        const urls = indexedPages
          .map(
            ({ toolPath, language }) =>
              `  <url><loc>${escapeHtml(canonicalUrl(toolPath, language))}</loc></url>`,
          )
          .join('\n')
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        })
        this.emitFile({
          type: 'asset',
          fileName: '_redirects',
          source:
            [
              '/index.html / 301',
              ...supportedLanguages.flatMap((language) =>
                Object.entries(categoryRedirects).flatMap(
                  ([category, tool]) => {
                    const from = languagePath(language, category)
                    const to = languagePath(language, tool)
                    return [`${from} ${to} 301`, `${from}/ ${to} 301`]
                  },
                ),
              ),
              ...indexedPages
                .slice(1)
                .flatMap(({ path }) => [
                  `${path}/ ${path} 301`,
                  `${path}.html ${path} 301`,
                ]),
            ].join('\n') + '\n',
        })
      },
    },
  }
}
