import { Button } from '@/components/ui/button'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const handleToggle = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      case 'system':
        return <Monitor className="h-4 w-4" />
      default:
        return <Sun className="h-4 w-4" />
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode'
      case 'dark':
        return 'Dark mode'
      case 'system':
        return 'System mode'
      default:
        return 'Light mode'
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="h-8 w-8 rounded-lg hover:bg-accent/50 transition-colors"
      title={getLabel()}
    >
      {getIcon()}
    </Button>
  )
} 