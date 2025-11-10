'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginForm } from '@/components/login-form'
import { LoginImageSlideshow } from '@/components/login-image-slideshow'
import { FossappLogo } from '@/components/fossapp-logo'
import { getProductCountAction } from '@/lib/actions'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [productCount, setProductCount] = useState<number | null>(null)

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  useEffect(() => {
    const fetchProductCount = async () => {
      const count = await getProductCountAction()
      setProductCount(count)
    }
    fetchProductCount()
  }, [])

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
            <FossappLogo width={70} height={40} />
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
          {productCount !== null ? (
            <>Professional lighting database • {Math.floor(productCount / 100) * 100}+ products</>
          ) : (
            <>Professional lighting database • Loading...</>
          )}
        </div>
      </div>

      {/* Right Panel - Image Slideshow */}
      <div className="relative hidden bg-muted lg:block">
        <LoginImageSlideshow />
      </div>
    </div>
  )
}
