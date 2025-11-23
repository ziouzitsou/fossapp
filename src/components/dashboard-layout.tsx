'use client'

import { useState, ReactNode, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { FaSignOutAlt, FaChevronDown, FaBars, FaTimes, FaSun, FaMoon, FaDesktop, FaCheck } from 'react-icons/fa'
import { useTheme } from 'next-themes'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { useDevSession } from '@/lib/use-dev-session'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session } = useDevSession()
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  const navigation = getNavigation(pathname)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } fixed inset-y-0 left-0 z-30 w-64 bg-card shadow-lg border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col`}>
        <div className="flex items-center justify-between h-16 px-6 border-b">
          <div className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Company Logo"
              width={80}
              height={80}
              className="h-20 w-20 dark:hidden"
            />
            <Image
              src="/logo-dark.svg"
              alt="Company Logo"
              width={80}
              height={80}
              className="h-20 w-20 hidden dark:block"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-8 flex-1">
          <div className="px-3">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    item.current
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  } group flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 transition-colors`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Version display at bottom */}
        <div className="border-t">
          <VersionDisplay />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-card shadow-sm border-b">
          <div className="flex items-center h-16 px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-muted-foreground hover:text-foreground"
            >
              <FaBars className="h-5 w-5" />
            </button>

            <div className="flex-1" />

            {/* Right side items */}
            <div className="flex items-center gap-4">
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 text-sm focus:outline-none"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-medium">
                      {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden md:block text-foreground">{session?.user?.name || 'User'}</span>
                  <FaChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-card rounded-md shadow-lg py-1 z-20 border">
                      {/* Theme options */}
                      {mounted && (
                        <>
                          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Theme
                          </div>
                          {[
                            { name: 'Light', value: 'light', icon: FaSun },
                            { name: 'Dark', value: 'dark', icon: FaMoon },
                            { name: 'System', value: 'system', icon: FaDesktop },
                          ].map((themeOption) => {
                            const Icon = themeOption.icon
                            const isActive = theme === themeOption.value
                            return (
                              <button
                                key={themeOption.value}
                                onClick={() => {
                                  setTheme(themeOption.value)
                                  setDropdownOpen(false)
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 justify-between"
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  <span>{themeOption.name}</span>
                                </div>
                                {isActive && <FaCheck className="h-3 w-3 text-primary" />}
                              </button>
                            )
                          })}
                          <div className="my-1 border-t" />
                        </>
                      )}

                      {/* Sign out */}
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                      >
                        <FaSignOutAlt />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
