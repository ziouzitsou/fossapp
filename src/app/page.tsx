'use client'

import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm } from '@/components/login-form'
import { LoginImageSlideshow } from '@/components/login-image-slideshow'
import { FossappLogo } from '@/components/fossapp-logo'
import { ProductCountDisplay } from '@/components/product-count-display'

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
      <div className="relative flex flex-col gap-4 p-6 md:p-10">
        {/* Header with Logo */}
        <div className="flex items-center justify-center py-4">
          <a href="#" className="flex items-center gap-2 font-medium">
            <FossappLogo width={200} height={120} />
          </a>
        </div>

        {/* Theme Toggle - Top Right Corner */}
        <div className="absolute top-6 right-6 md:top-10 md:right-10">
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
          <ProductCountDisplay />
        </div>
      </div>

      {/* Right Panel - Image Slideshow */}
      <div className="relative hidden bg-muted lg:block">
        <LoginImageSlideshow />
      </div>
    </div>
  )
}
