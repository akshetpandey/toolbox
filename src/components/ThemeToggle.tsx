import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const themeOptions = [
    { value: 'light', icon: Sun, label: 'Light mode' },
    { value: 'dark', icon: Moon, label: 'Dark mode' },
    { value: 'system', icon: Monitor, label: 'System mode' }
  ] as const

  return (
    <div className="relative flex items-center bg-muted/30 rounded-lg p-1 h-8">
      {/* Background slider */}
      <div 
        className="absolute inset-y-1 bg-background rounded-md shadow-sm transition-all duration-200 ease-in-out"
        style={{
          width: '33.333%',
          left: theme === 'light' ? '4px' : theme === 'dark' ? '33.333%' : '66.666%'
        }}
      />
      
      {/* Theme options */}
      {themeOptions.map((option) => {
        const Icon = option.icon
        const isActive = theme === option.value
        
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`
              relative z-10 flex items-center justify-center w-8 h-6 rounded-md transition-all duration-200 ease-in-out
              ${isActive 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
            title={option.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
} 