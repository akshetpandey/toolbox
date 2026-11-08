import { allTools } from './tools.ts'

export const siteUrl = 'https://toolbox.computer'

export const homePage = {
  path: '/',
  title: 'Free Online File Tools for PDFs, Images and Video | Toolbox',
  heading: 'Free online file tools',
  description:
    'Merge PDFs, resize images, trim video and audio, convert documents, and unzip files for free. Toolbox processes files on your device without uploads.',
  intro:
    'Merge PDFs, resize photos, trim video and audio, convert documents, and open ZIP files. Your files stay on your device.',
  canonical: `${siteUrl}/`,
}

export const indexedPages = [
  homePage,
  ...allTools.map((tool) => ({
    path: tool.route,
    title: `${tool.pageTitle} | Toolbox`,
    heading: tool.name,
    description: tool.instructions,
    intro: tool.description,
    canonical: `${siteUrl}${tool.route}`,
  })),
]

export const notFoundPage = {
  path: '/404',
  title: 'Tool Not Found | Toolbox',
  heading: 'This tool could not be found',
  description: 'Choose another task from the toolbox.',
  intro: 'Choose another task from the toolbox.',
}

interface Page {
  path: string
  title: string
  heading: string
  description: string
  intro: string
  canonical?: string
}

export const pages: Page[] = [...indexedPages, notFoundPage]

export function getPage(pathname: string): Page {
  const path = pathname.replace(/\/$/, '') || '/'
  return pages.find((page) => page.path === path) ?? notFoundPage
}

type MetaTag = { content: string } & (
  | { name: string; property?: never }
  | { property: string; name?: never }
)

export function pageMeta(page: Page): MetaTag[] {
  const description = { name: 'description', content: page.description }
  if (!page.canonical) {
    return [description, { name: 'robots', content: 'noindex' }]
  }
  return [
    description,
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Toolbox' },
    { property: 'og:title', content: page.title },
    { property: 'og:description', content: page.description },
    { property: 'og:url', content: page.canonical },
    { property: 'og:image', content: `${siteUrl}/logo512.png` },
    { property: 'og:image:alt', content: 'Toolbox logo' },
    { name: 'twitter:card', content: 'summary' },
  ]
}
