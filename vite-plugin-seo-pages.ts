import type { Plugin } from 'vite'
import { indexedPages, pageMeta, pages } from './src/lib/seo.ts'
import { categoryRedirects } from './src/lib/toolPaths.ts'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderPage(template: string, page: (typeof pages)[number]) {
  const head = [
    `<title data-static-seo>${escapeHtml(page.title)}</title>`,
    ...pageMeta(page).map(
      ({ name, property, content }) =>
        `<meta data-static-seo ${name ? `name="${name}"` : `property="${property}"`} content="${escapeHtml(content)}" />`,
    ),
  ]
  if (page.canonical) {
    head.push(
      `<link data-static-seo rel="canonical" href="${page.canonical}" />`,
    )
  }

  const homeLink = '<a class="underline" href="/">Browse all tools</a>'
  const links =
    page.path === '/'
      ? `<ul class="space-y-2">${indexedPages
          .filter((tool) => tool.path !== '/')
          .map(
            (tool) =>
              `<li><a class="underline" href="${tool.path}">${escapeHtml(tool.heading)}</a></li>`,
          )
          .join('')}</ul>`
      : homeLink
  const instructions = page.instructions
    ? `<h2 class="text-lg font-semibold">How to use this tool</h2><p>${escapeHtml(page.instructions)}</p>`
    : ''
  const javascriptNotice = page.canonical
    ? '<noscript><p>Enable JavaScript to process files in your browser.</p></noscript>'
    : ''

  return template
    .replace('</head>', `  ${head.join('\n    ')}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><main class="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-8 sm:py-12">
        <h1 class="text-3xl font-semibold tracking-tight">${escapeHtml(page.heading)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        ${instructions}
        ${javascriptNotice}
        ${links}
      </main></div>`,
    )
}

/** Emit crawlable landing pages around Vite's compiled client entry point. */
export function seoPagesPlugin(): Plugin {
  return {
    name: 'seo-pages',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const index = bundle['index.html']
        if (index?.type !== 'asset' || typeof index.source !== 'string') {
          throw new Error('Expected Vite to emit index.html before SEO pages')
        }
        const template = index.source
        for (const page of pages) {
          const html = renderPage(template, page)
          if (page.path === '/') index.source = html
          else
            this.emitFile({
              type: 'asset',
              fileName: `${page.path.slice(1)}.html`,
              source: html,
            })
        }

        const urls = indexedPages
          .map(
            ({ canonical }) =>
              `  <url><loc>${escapeHtml(canonical)}</loc></url>`,
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
              ...Object.entries(categoryRedirects).flatMap(([from, to]) => [
                `${from} ${to} 301`,
                `${from}/ ${to} 301`,
              ]),
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
