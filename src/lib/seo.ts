import { english } from '../i18n/messages.ts'
import type { Translator } from '../i18n/messages.ts'
import { languagePath, supportedLanguages } from '../i18n/locales.ts'
import type { Language } from '../i18n/locales.ts'

export const siteUrl = 'https://toolbox.computer'
export const notFoundPath = '/404'

export function canonicalUrl(path: string, language: Language) {
  return siteUrl + languagePath(language, path)
}

export function getHomePage(t: Translator, language: Language = 'en') {
  return {
    path: '/',
    title: t('seoHomeTitle'),
    heading: t('seoHomeHeading'),
    description: t('seoHomeDescription'),
    intro: t('seoHomeIntro'),
    canonical: canonicalUrl('/', language),
  }
}

export const homePage = getHomePage(english)

export function getNotFoundPage(t: Translator) {
  return {
    path: notFoundPath,
    title: t('seoNotFoundTitle'),
    heading: t('seoNotFoundHeading'),
    description: t('seoNotFoundDescription'),
    intro: t('seoNotFoundIntro'),
  }
}

export interface Page {
  path: string
  title: string
  description: string
  canonical?: string
}

export function pageAlternates(path: string) {
  return [
    ...supportedLanguages.map((language) => ({
      hrefLang: language,
      href: canonicalUrl(path, language),
    })),
    { hrefLang: 'x-default', href: canonicalUrl(path, 'en') },
  ]
}

type MetaTag = { content: string } & (
  | { name: string; property?: never }
  | { property: string; name?: never }
)

export function pageMeta(page: Page, t: Translator): MetaTag[] {
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
    { property: 'og:image:alt', content: t('seoLogoAlt') },
    { name: 'twitter:card', content: 'summary' },
  ]
}
