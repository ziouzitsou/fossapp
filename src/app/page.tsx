'use client'

import { useSession, signIn } from 'next-auth/react'
import { FaGoogle } from 'react-icons/fa'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Home() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Welcome back!</CardTitle>
            <CardDescription>You&apos;re successfully signed in</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={session.user?.image || ''} alt="Profile" />
                <AvatarFallback>{session.user?.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{session.user?.name}</h2>
                <p className="text-muted-foreground">{session.user?.email}</p>
              </div>
            </div>

            <Button asChild className="w-full">
              <Link href="/dashboard">
                Enter Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="max-w-md w-full mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Welcome</CardTitle>
          <CardDescription>Sign in with your Google account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => signIn('google')}
            variant="outline"
            className="w-full"
          >
            <FaGoogle className="mr-2 h-4 w-4 text-red-500" />
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}