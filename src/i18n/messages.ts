import sourceMessages from './locales/en.json' with { type: 'json' }

export type MessageKey =
  | keyof typeof sourceMessages
  | keyof typeof import('./en-workspaces.json')
  | keyof typeof import('./en-tool-content.json')
export type MessageValues = Record<
  string,
  string | number | boolean | null | undefined
>
export type Catalog = Partial<Record<MessageKey, string>>
export type Translator = (
  key: MessageKey,
  values?: MessageValues,
  count?: number,
) => string

const englishShell: Catalog = sourceMessages
const englishPluralRules = new Intl.PluralRules('en')

export function createTranslator(
  locale: string,
  catalog: Catalog = {},
  fallback: Catalog = sourceMessages,
): Translator {
  const pluralRules =
    locale === 'en' ? englishPluralRules : new Intl.PluralRules(locale)
  return (key, values, count) => {
    const variant =
      count === undefined
        ? undefined
        : variantKey(key, pluralRules.select(count))
    const englishVariant =
      count === undefined
        ? undefined
        : variantKey(key, englishPluralRules.select(count))
    const translated = (variant && catalog[variant]) ?? catalog[key]
    const message =
      translated ??
      (englishVariant && fallback[englishVariant]) ??
      fallback[key] ??
      englishShell[key] ??
      key
    return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
      return name === 'count' && count !== undefined
        ? String(count)
        : String(values?.[name] ?? placeholder)
    })
  }
}

function variantKey(key: MessageKey, category: Intl.LDMLPluralRule) {
  return (key + category[0].toUpperCase() + category.slice(1)) as MessageKey
}

export const english = createTranslator('en')

export interface LocalizedMessage {
  key: MessageKey
  values?: MessageValues
  count?: number
}

export function message(
  key: MessageKey,
  values?: MessageValues,
  count?: number,
): LocalizedMessage {
  return { key, values, count }
}

export function renderMessage(t: Translator, text: string | LocalizedMessage) {
  return typeof text === 'string' ? text : t(text.key, text.values, text.count)
}
