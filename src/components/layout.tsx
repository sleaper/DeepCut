import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Home,
  Scissors,
  Video,
  Menu,
  X,
  Settings,
  Clipboard,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'

const navigation = [
  {
    name: 'Home',
    href: '/',
    icon: Home
  },
  {
    name: 'Clips',
    href: '/clips',
    icon: Scissors
  },
  {
    name: 'Videos',
    href: '/videos',
    icon: Video
  },
  {
    name: 'Editor',
    href: '/clip-editor',
    icon: Clipboard
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings
  }
]

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const NavItems = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      {navigation.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors',
              location.pathname === item.href
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground',
              collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
            )}
            onClick={() => setIsMobileMenuOpen(false)}
            title={collapsed ? item.name : undefined}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && item.name}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 transition-all duration-300',
          isSidebarCollapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        <div className="flex flex-col flex-grow pt-5 bg-background border-r overflow-hidden">
          <div
            className={cn(
              'flex flex-row items-center justify-between flex-shrink-0 px-4 mb-8',
              isSidebarCollapsed && 'flex-col gap-4'
            )}
          >
            <div className={cn('flex items-center', isSidebarCollapsed && 'flex-col gap-2')}>
              <Scissors className="h-6 w-6 text-primary flex-shrink-0" />
              {!isSidebarCollapsed && <h1 className="ml-2 text-xl font-bold">DeepCut</h1>}
            </div>
            <div className={cn('flex gap-2', isSidebarCollapsed && 'flex-col gap-2')}>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="h-8 w-8 p-0"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <nav className="flex-1 px-4 space-y-1">
            <NavItems collapsed={isSidebarCollapsed} />
          </nav>
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Scissors className="h-6 w-6 text-primary" />
            <h1 className="ml-2 text-xl font-bold">DeepCut</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="border-b bg-background">
            <nav className="p-4 space-y-1">
              <NavItems />
            </nav>
          </div>
        )}
      </div>

      {/* Main content */}
      <div
        className={cn(
          'flex-1 transition-all duration-300',
          isSidebarCollapsed ? 'md:pl-16' : 'md:pl-64'
        )}
      >
        <ScrollArea className="h-screen">
          <main className="p-4 md:p-8">{children}</main>
        </ScrollArea>
      </div>
    </div>
  )
}
