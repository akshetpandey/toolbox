import { allTools } from './tools.ts'

const siteUrl = 'https://toolbox.computer'

export const categoryRedirects = {
  '/images': '/images/metadata',
  '/videos': '/videos/metadata',
  '/pdfs': '/pdfs/merge',
  '/office-documents': '/office-documents/convert',
  '/archives': '/archives/compress',
  '/utilities': '/utilities/hash',
} as const

export const homePage = {
  path: '/',
  title: 'Free, Private File Tools for Your Browser | Toolbox',
  heading: 'Private file tools, right in your browser.',
  description:
    'Resize images, trim videos, merge PDFs, open archives, and more. Toolbox is free and open source and processes files in your browser without uploads.',
  intro:
    'Resize, convert, and organize your files. Everything is processed on your device, with no uploads or account required.',
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
    instructions: tool.instructions,
  })),
]

const unavailableDescription =
  'This tool is not available yet. You can merge PDF files today.'

export const unavailablePages = [
  {
    path: '/pdfs/compress',
    title: 'Compress PDFs (Coming Soon) | Toolbox',
    heading: 'Compress PDFs',
    description: unavailableDescription,
    intro: unavailableDescription,
  },
  {
    path: '/pdfs/split',
    title: 'Split PDFs (Coming Soon) | Toolbox',
    heading: 'Split PDFs',
    description: unavailableDescription,
    intro: unavailableDescription,
  },
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
  instructions?: string
}

export const pages: Page[] = [
  ...indexedPages,
  ...unavailablePages,
  notFoundPage,
]

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
