import { useTranslator } from '@/i18n/LocaleContext'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const t = useTranslator()
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', icon: Sun, label: t('themeToggleLightMode') },
    { value: 'dark', icon: Moon, label: t('themeToggleDarkMode') },
    { value: 'system', icon: Monitor, label: t('themeToggleSystemMode') },
  ] as const
  return (
    <div
      role="group"
      aria-label={t('themeToggleAppearance')}
      className="inline-flex rounded-lg border border-border bg-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={theme === option.value}
          title={option.label}
          onClick={() => setTheme(option.value)}
          className={`flex size-11 items-center justify-center rounded-md focus-ring ${theme === option.value ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <option.icon aria-hidden="true" className="size-4" />
        </button>
      ))}
    </div>
  )
}
