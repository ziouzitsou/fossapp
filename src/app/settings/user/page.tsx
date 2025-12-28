'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useDevSession } from '@/lib/use-dev-session'
import {
  Spinner,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from '@fossapp/ui'
import { getUserProfileAction, type UserProfile } from '@/lib/actions'
import { Calendar, Mail, Shield, LogIn } from 'lucide-react'

export default function UserSettingsPage() {
  const { data: session, status } = useDevSession()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

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

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Could not load profile information
        </CardContent>
      </Card>
    )
  }

  return (
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
  )
}
