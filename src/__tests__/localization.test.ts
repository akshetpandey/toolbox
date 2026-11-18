import { expect, test } from 'vitest'
import shell from '@/i18n/locales/en.json'
import workspace from '@/i18n/en-workspaces.json'
import toolContent from '@/i18n/en-tool-content.json'
import { createTranslator, imageDimensions } from '@/i18n/messages'
import type { Catalog } from '@/i18n/messages'
import ar from '@/i18n/locales/ar.json'
import {
  getLanguagePreference,
  languagePath,
  matchBrowserLanguage,
  splitLanguagePath,
  supportedLanguages,
} from '@/i18n/locales'

test('uses the first supported browser preference and matches regional tags', () => {
  expect(matchBrowserLanguage(['fr-CA', 'es-MX', 'en'])).toBe('fr')
  expect(matchBrowserLanguage(['it-IT', 'es-MX', 'en'])).toBe('es')
  expect(matchBrowserLanguage(['nl-BE', 'en'])).toBe('nl')
  expect(matchBrowserLanguage(['PT-br', 'en'])).toBe('pt-BR')
  expect(matchBrowserLanguage(['pt-PT', 'en'])).toBe('pt-BR')
  expect(matchBrowserLanguage(['it', 'zh-Hans'])).toBe('en')
})

test('validates the cookie independently of locale URLs', () => {
  expect(getLanguagePreference('theme=night; toolbox-language=ja')).toBe('ja')
  expect(getLanguagePreference('toolbox-language=invalid')).toBe('browser')
  expect(getLanguagePreference('toolbox-language=en')).toBe('en')
  expect(splitLanguagePath('/ar/pdfs/merge')).toEqual({
    language: 'ar',
    path: '/pdfs/merge',
  })
  expect(splitLanguagePath('/es')).toEqual({ language: 'es', path: '/' })
  expect(splitLanguagePath('/estimation')).toEqual({
    language: 'en',
    path: '/estimation',
  })
  expect(languagePath('en', '/pdfs/merge')).toBe('/pdfs/merge')
  expect(getLanguagePreference('toolbox-language=pt-BR')).toBe('pt-BR')
  expect(languagePath('pt-BR', '/pdfs/merge')).toBe('/pt-br/pdfs/merge')
  expect(splitLanguagePath('/pt-br/pdfs/merge')).toEqual({
    language: 'pt-BR',
    path: '/pdfs/merge',
  })
})

const source = { ...shell, ...workspace, ...toolContent }

test('keeps non-square dimensions in width-by-height order in Arabic', () => {
  const values = { dimensions: imageDimensions(300, 200) }
  expect(createTranslator('ar', ar)('mediaDimensions', values)).toBe(
    '\u2066300 × 200\u2069',
  )
  expect(createTranslator('en', {}, source)('mediaDimensions', values)).toBe(
    '300 × 200',
  )
})

const catalogs = import.meta.glob<Catalog>('../i18n/locales/*.json', {
  import: 'default',
})

const placeholders = (message: string) =>
  Array.from(
    message.matchAll(/\{\w+\}/g),
    ([placeholder]) => placeholder,
  ).sort()

test.each(supportedLanguages.filter((language) => language !== 'en'))(
  '%s covers the English catalog and preserves its placeholders',
  async (language) => {
    const catalog = await catalogs[`../i18n/locales/${language}.json`]()
    expect(Object.keys(catalog)).toEqual(
      expect.arrayContaining(Object.keys(source)),
    )
    const english = source as Record<string, string>
    const categories = new Intl.PluralRules(language).resolvedOptions()
      .pluralCategories
    for (const [key, translation] of Object.entries(catalog)) {
      const variant = /^(.*?)(Zero|One|Two|Few|Many|Other)$/.exec(key)
      const stem = variant?.[1] ?? key
      const text = english[key] ?? english[stem]
      if (!Object.hasOwn(english, key)) {
        expect(english[stem + 'One'], key).toBeDefined()
        expect(categories, key).toContain(variant?.[2].toLowerCase())
      }
      expect(text, key).toBeDefined()
      expect(translation.trim(), key).not.toBe('')
      expect(placeholders(translation), key).toEqual(placeholders(text))
    }
  },
)

test('uses Polish singular, few, and many forms for file and page counts', async () => {
  const catalog = await catalogs['../i18n/locales/pl.json']()
  const t = createTranslator('pl', catalog)
  expect(
    [1, 2, 5, 12, 22].map((count) => t('archiveFileCount', {}, count)),
  ).toEqual(['1 plik', '2 pliki', '5 plików', '12 plików', '22 pliki'])
  expect([1, 2, 5].map((count) => t('pdfsMergePageCount', {}, count))).toEqual([
    '1 strona',
    '2 strony',
    '5 stron',
  ])
})
