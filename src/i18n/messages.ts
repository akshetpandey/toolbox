import sourceMessages from './locales/en.json' with { type: 'json' }

export type MessageKey =
  | keyof typeof sourceMessages
  | keyof typeof import('./en-workspaces.json')
  | keyof typeof import('./en-tool-content.json')
export type MessageValues = Record<
  string,
  string | number | boolean | null | undefined | LeftToRightText
>
export type Catalog = Partial<Record<MessageKey, string>>
export type Translator = (
  key: MessageKey,
  values?: MessageValues,
  count?: number,
) => string

interface LeftToRightText {
  ltr: string
}

export function imageDimensions(
  width: number,
  height: number,
): LeftToRightText {
  return { ltr: `${width} × ${height}` }
}

const englishShell: Catalog = sourceMessages
const englishPluralRules = new Intl.PluralRules('en')

export function createTranslator(
  locale: string,
  catalog: Catalog = {},
  fallback: Catalog = sourceMessages,
): Translator {
  const rightToLeft = locale === 'ar'
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
      const value =
        name === 'count' && count !== undefined ? count : values?.[name]
      if (typeof value === 'object' && value) {
        return rightToLeft ? `\u2066${value.ltr}\u2069` : value.ltr
      }
      return String(value ?? placeholder)
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

export type MessageText = string | LocalizedMessage

export function renderMessage(t: Translator, text: MessageText) {
  return typeof text === 'string' ? text : t(text.key, text.values, text.count)
}
