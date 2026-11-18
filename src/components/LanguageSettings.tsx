import { useId, useState } from 'react'
import { useLocale, useTranslator } from '@/i18n/LocaleContext'
import { isLanguage, languages, supportedLanguages } from '@/i18n/locales'

export function LanguageSettings({ disabled }: { disabled: boolean }) {
  const id = useId()
  const t = useTranslator()
  const { preference, selectLanguage } = useLocale()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div data-slot="language-settings" className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {t('languageSettings')}
      </label>
      <select
        id={id}
        value={preference}
        disabled={disabled || pending}
        aria-busy={pending}
        onChange={(event) => {
          const choice = event.currentTarget.value
          setFailed(false)
          setPending(true)
          void selectLanguage(isLanguage(choice) ? choice : 'browser')
            .catch(() => setFailed(true))
            .finally(() => setPending(false))
        }}
        className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm focus-ring"
      >
        <option value="browser">{t('languageBrowserDefault')}</option>
        {supportedLanguages.map((option) => (
          <option key={option} lang={option} value={option}>
            {languages[option]}
          </option>
        ))}
      </select>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('languageLoadFailed')}
        </p>
      )}
    </div>
  )
}
