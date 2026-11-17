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
  expect(matchBrowserLanguage(['fr-CA', 'es-MX', 'en'])).toBe('es')
  expect(matchBrowserLanguage(['nl-BE', 'en'])).toBe('nl')
  expect(matchBrowserLanguage(['fr', 'zh-Hans'])).toBe('en')
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
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(source).sort())
    for (const [key, text] of Object.entries(source)) {
      const translation = (catalog as Record<string, string>)[key]
      expect(translation.trim(), key).not.toBe('')
      expect(placeholders(translation), key).toEqual(placeholders(text))
    }
  },
)
