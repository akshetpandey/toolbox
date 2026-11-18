import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  useRef,
  useSyncExternalStore,
} from 'react'
import type { ReactNode } from 'react'
import type { RouterHistory } from '@tanstack/react-router'
import { loadTranslator, translatorFor } from './catalogs'
import {
  getLanguagePreference,
  languageCookie,
  languageDirection,
  languagePath,
  matchBrowserLanguage,
  splitLanguagePath,
} from './locales'
import type { Language, LanguagePreference } from './locales'
import { isToolboxPagePath } from '@/lib/toolPaths'

interface LocaleState {
  language: Language
  preference: LanguagePreference
  selectLanguage: (preference: LanguagePreference) => Promise<void>
}
const LocaleContext = createContext<LocaleState>({
  language: 'en',
  preference: 'browser',
  selectLanguage: () => Promise.resolve(),
})

export function useLocale() {
  return useContext(LocaleContext)
}

export function useTranslator() {
  return translatorFor(useLocale().language)
}

export function LocaleProvider({
  history,
  children,
}: {
  history: RouterHistory
  children: ReactNode
}) {
  const pathname = useSyncExternalStore(
    history.subscribe,
    () => history.location.pathname,
    () => history.location.pathname,
  )
  const { language } = splitLanguagePath(pathname)
  const [preference, setPreference] = useState<LanguagePreference>('browser')
  const request = useRef(0)

  async function navigate(next: Language) {
    const version = ++request.current
    const { language: current } = splitLanguagePath(history.location.pathname)
    if (next !== current) await loadTranslator(next)
    if (version !== request.current) return false
    // The user may have opened a different tool while the catalog loaded.
    const latest = history.location
    const { path, language: latestLanguage } = splitLanguagePath(
      latest.pathname,
    )
    if (latestLanguage !== next) {
      history.replace(languagePath(next, path) + latest.search + latest.hash)
    }
    return true
  }

  async function selectLanguage(next: LanguagePreference) {
    const target =
      next === 'browser' ? matchBrowserLanguage(navigator.languages) : next
    if (!(await navigate(target))) return
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    const age = next === 'browser' ? 0 : 365 * 24 * 60 * 60
    document.cookie = `${languageCookie}=${next}; Path=/; Max-Age=${age}; SameSite=Lax${secure}`
    setPreference(next)
  }

  const applyInitialPreference = useEffectEvent(() => {
    const saved = getLanguagePreference(document.cookie)
    const browser = matchBrowserLanguage(navigator.languages)
    setPreference(saved)
    const entry = splitLanguagePath(history.location.pathname)
    if (entry.language !== 'en' || !isToolboxPagePath(entry.path)) return
    const target = saved === 'browser' ? browser : saved
    void navigate(target).catch(() => {
      // The static English page can still be used when a catalog is unavailable.
    })
  })
  useEffect(() => {
    applyInitialPreference()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = languageDirection(language)
  }, [language])

  return (
    <LocaleContext value={{ language, preference, selectLanguage }}>
      {children}
    </LocaleContext>
  )
}
