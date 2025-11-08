'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm } from '@/components/login-form'
import { LoginImageSlideshow } from '@/components/login-image-slideshow'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  if (status === 'loading' || session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left Panel - Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Header with Logo and Theme Toggle */}
        <div className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Lightbulb className="size-5" />
            </div>
            <span className="text-lg font-semibold">FOSSAPP</span>
          </a>
          <ThemeToggle />
        </div>

        {/* Centered Login Form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>

        {/* Footer */}
        <div className="text-balance text-center text-xs text-muted-foreground">
          Professional lighting database • 56,000+ products
        </div>
      </div>

      {/* Right Panel - Image Slideshow */}
      <div className="relative hidden bg-muted lg:block">
        <LoginImageSlideshow />
      </div>
    </div>
  )
}
