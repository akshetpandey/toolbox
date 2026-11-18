export const languages = {
  en: 'English',
  es: 'Español',
  ja: '日本語',
  ru: 'Русский',
  ar: 'العربية',
  nl: 'Nederlands',
  pl: 'Polski',
  id: 'Bahasa Indonesia',
  de: 'Deutsch',
  fr: 'Français',
  'pt-BR': 'Português (Brasil)',
} as const

export type Language = keyof typeof languages
export type LanguagePreference = Language | 'browser'
export const supportedLanguages = Object.keys(languages) as Language[]
export const languageCookie = 'toolbox-language'

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(languages, value)
}

export function matchBrowserLanguage(preferences: readonly string[]): Language {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split('-')[0]
    if (base === 'pt') return 'pt-BR'
    if (isLanguage(base)) return base
  }
  return 'en'
}

export function splitLanguagePath(pathname: string) {
  const segment = pathname.split('/')[1]
  const language = segment === 'pt-br' ? 'pt-BR' : segment
  if (isLanguage(language) && language !== 'en') {
    return {
      language,
      path: pathname.slice(segment.length + 1) || '/',
    }
  }
  return { language: 'en' as const, path: pathname }
}

export function languagePath(language: Language, path: string) {
  return language === 'en'
    ? path
    : '/' + language.toLowerCase() + (path === '/' ? '' : path)
}

export function languageDirection(language: Language) {
  return language === 'ar' ? 'rtl' : 'ltr'
}

export function getLanguagePreference(cookie: string): LanguagePreference {
  const value = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(languageCookie + '='))
    ?.slice(languageCookie.length + 1)
  return isLanguage(value) ? value : 'browser'
}
