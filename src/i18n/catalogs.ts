import type { Language } from './locales'
import { createTranslator, english } from './messages'
import type { Catalog, Translator } from './messages'

const imports = import.meta.glob<Catalog>(
  ['./locales/*.json', '!./locales/en.json'],
  {
    import: 'default',
  },
)
const catalogs = new Map<Language, Catalog>()
const translators = new Map<Language, Translator>([['en', english]])
const loading = new Map<Language, Promise<Translator>>()

export function catalogFor(language: Language) {
  return catalogs.get(language)
}

export function translatorFor(language: Language) {
  return translators.get(language) ?? english
}

export function loadTranslator(language: Language): Promise<Translator> {
  const existing = translators.get(language)
  if (existing) return Promise.resolve(existing)

  const pending = loading.get(language)
  if (pending) return pending

  const load = imports[`./locales/${language}.json`]()
    .then((catalog) => {
      const translate = createTranslator(language, catalog)
      catalogs.set(language, catalog)
      translators.set(language, translate)
      return translate
    })
    .finally(() => loading.delete(language))
  loading.set(language, load)
  return load
}
