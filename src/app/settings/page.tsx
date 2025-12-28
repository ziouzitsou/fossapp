'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useDevSession } from '@/lib/use-dev-session'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import {
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { getUserProfileAction, type UserProfile } from '@/lib/actions'
import { Calendar, Mail, Shield, LogIn } from 'lucide-react'

export default function SettingsPage() {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    async function loadProfile() {
      if (session?.user?.email) {
        setLoadingProfile(true)
        const result = await getUserProfileAction(session.user.email)
        if (result.success && result.data) {
          setProfile(result.data)
        }
        setLoadingProfile(false)
      }
    }

    if (status === 'authenticated') {
      loadProfile()
    }
  }, [session?.user?.email, status])

  if (!session && status !== 'loading') {
    return null
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <ProtectedPageLayout>
      {status === 'loading' ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your account and application preferences
              </p>
            </div>

            <Tabs defaultValue="user" className="w-full">
              <TabsList>
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="symbols">Symbols</TabsTrigger>
              </TabsList>

              <TabsContent value="user" className="mt-6">
                {loadingProfile ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : profile ? (
                  <div className="space-y-6">
                    {/* Profile Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Profile</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-6">
                          {/* Avatar */}
                          <div className="relative w-20 h-20 flex-shrink-0">
                            <Image
                              src={profile.image || session?.user?.image || '/default-avatar.png'}
                              alt="Profile"
                              fill
                              sizes="80px"
                              className="rounded-full object-cover border-2 border-border"
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 space-y-3">
                            <div>
                              <h3 className="text-xl font-semibold">
                                {profile.name || session?.user?.name || 'Unknown User'}
                              </h3>
                              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                <Mail className="h-4 w-4" />
                                <span>{profile.email}</span>
                              </div>
                            </div>

                            {/* Group Badge */}
                            {profile.group && (
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-muted-foreground" />
                                <Badge variant="secondary">
                                  {profile.group.display_name}
                                </Badge>
                                {profile.group.description && (
                                  <span className="text-sm text-muted-foreground">
                                    - {profile.group.description}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Activity Stats Card */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                          {/* First Login */}
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">First Login</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(profile.first_login_at)}
                              </p>
                            </div>
                          </div>

                          {/* Last Login */}
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <LogIn className="h-5 w-5 text-muted-foreground mt-0.5" />
                            <div>
                              <p className="text-sm font-medium">Last Login</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(profile.last_login_at)}
                              </p>
                            </div>
                          </div>

                          {/* Login Count */}
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                              #
                            </div>
                            <div>
                              <p className="text-sm font-medium">Total Logins</p>
                              <p className="text-sm text-muted-foreground">
                                {profile.login_count} times
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Could not load profile information
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="symbols" className="mt-6">
                {/* Symbols settings content will go here */}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </ProtectedPageLayout>
  )
}
