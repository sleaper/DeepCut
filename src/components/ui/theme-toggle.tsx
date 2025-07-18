import React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const handleThemeToggle = () => {
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
        return <Monitor className="h-4 w-4" />
    }
  }

  const getTooltipText = () => {
    switch (theme) {
      case 'light':
        return 'Switch to dark theme'
      case 'dark':
        return 'Switch to system theme'
      case 'system':
        return 'Switch to light theme'
      default:
        return 'Toggle theme'
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleThemeToggle}
      title={getTooltipText()}
      className="h-8 w-8 p-0"
    >
      {getIcon()}
      <span className="sr-only">{getTooltipText()}</span>
    </Button>
  )
}
