import { useLocale } from './LocaleContext'
import { catalogFor } from './catalogs'
import { createTranslator } from './messages'
import type { Catalog, Translator } from './messages'
import { workspaceSource } from './workspaceMessages'
import { toolContent } from './toolContentMessages'

const source = { ...workspaceSource, ...toolContent }
const english = createTranslator('en', {}, source)
const translators = new WeakMap<Catalog, Translator>()

export function useWorkspaceTranslator() {
  const { language } = useLocale()
  const catalog = catalogFor(language)
  if (!catalog) return english

  const existing = translators.get(catalog)
  if (existing) return existing
  const translate = createTranslator(language, catalog, source)
  translators.set(catalog, translate)
  return translate
}
