import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', icon: Sun, label: 'Light mode' },
    { value: 'dark', icon: Moon, label: 'Dark mode' },
    { value: 'system', icon: Monitor, label: 'System mode' },
  ] as const
  return (
    <div
      role="group"
      aria-label="Appearance"
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
