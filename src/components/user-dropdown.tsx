'use client'

import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { logEventClient } from '@/lib/event-logger'
import Image from 'next/image'
import { FaSignOutAlt, FaSun, FaMoon, FaDesktop, FaCheck } from 'react-icons/fa'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface UserDropdownProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export function UserDropdown({ user }: UserDropdownProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = useCallback((newTheme: string) => {
    const previousTheme = theme
    setTheme(newTheme)
    logEventClient('theme_toggled', {
      previous_theme: previousTheme,
      new_theme: newTheme,
    })
  }, [theme, setTheme])

  const themes = [
    { name: 'Light', value: 'light', icon: FaSun },
    { name: 'Dark', value: 'dark', icon: FaMoon },
    { name: 'System', value: 'system', icon: FaDesktop },
  ]

  if (!user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto px-2 py-2 rounded-full">
          <div className="relative w-8 h-8">
            <Image
              src={user?.image || '/default-avatar.png'}
              alt="Profile"
              fill
              sizes="32px"
              className="rounded-full object-cover"
            />
          </div>
          <span className="hidden md:block font-medium text-foreground">
            {user?.name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>

        {mounted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Theme
            </DropdownMenuLabel>
            {themes.map((themeOption) => {
              const Icon = themeOption.icon
              const isActive = theme === themeOption.value
              return (
                <DropdownMenuItem
                  key={themeOption.value}
                  onClick={() => handleThemeChange(themeOption.value)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{themeOption.name}</span>
                  {isActive && <FaCheck className="ml-auto h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: '/' })}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <FaSignOutAlt className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
