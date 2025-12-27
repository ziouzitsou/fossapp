'use client'

import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState, useCallback } from 'react'
import { logEventClient } from '@fossapp/core/logging/client'
import Image from 'next/image'
import { FaSignOutAlt, FaSun, FaMoon, FaDesktop, FaCheck } from 'react-icons/fa'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { useMultiTheme, type Theme } from '@/lib/theme-context'

interface UserDropdownProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

export function UserDropdown({ user }: UserDropdownProps) {
  const [mounted, setMounted] = useState(false)
  const { theme: modeTheme, setTheme: setModeTheme } = useTheme()
  const { theme: styleTheme, setTheme: setStyleTheme } = useMultiTheme()

  // Hydration pattern - intentional
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleModeChange = useCallback((newTheme: string) => {
    const previousTheme = modeTheme
    setModeTheme(newTheme)
    logEventClient('theme_toggled', {
      type: 'mode',
      previous_theme: previousTheme,
      new_theme: newTheme,
    })
  }, [modeTheme, setModeTheme])

  const handleStyleChange = useCallback((newStyle: Theme) => {
    const previousStyle = styleTheme
    setStyleTheme(newStyle)
    logEventClient('theme_toggled', {
      type: 'style',
      previous_theme: previousStyle,
      new_theme: newStyle,
    })
  }, [styleTheme, setStyleTheme])

  const modeOptions = [
    { name: 'Light', value: 'light', icon: FaSun },
    { name: 'Dark', value: 'dark', icon: FaMoon },
    { name: 'System', value: 'system', icon: FaDesktop },
  ]

  const styleOptions: { name: string; value: Theme; color: string }[] = [
    { name: 'Default', value: 'default', color: 'oklch(0.556 0 0)' },
    { name: 'Minimal', value: 'minimal', color: 'oklch(0.623 0.188 260)' },
    { name: 'Emerald', value: 'emerald', color: 'oklch(0.835 0.130 161)' },
    { name: 'Ocean', value: 'ocean', color: 'oklch(0.672 0.161 245)' },
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
              Mode
            </DropdownMenuLabel>
            {modeOptions.map((option) => {
              const Icon = option.icon
              const isActive = modeTheme === option.value
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleModeChange(option.value)}
                  className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{option.name}</span>
                  {isActive && <FaCheck className="ml-auto h-3 w-3 text-primary" />}
                </DropdownMenuItem>
              )
            })}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Style
            </DropdownMenuLabel>
            {styleOptions.map((option) => {
              const isActive = styleTheme === option.value
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleStyleChange(option.value)}
                  className="cursor-pointer"
                >
                  <div
                    className="mr-2 h-4 w-4 rounded-full border border-border"
                    style={{ backgroundColor: option.color }}
                  />
                  <span>{option.name}</span>
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
