'use client'

import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Users, Search, Eye, LogIn } from 'lucide-react'
import { ActiveUser } from '@/lib/actions'
import { formatDistanceToNow } from 'date-fns'

interface MostActiveUsersCardProps {
  users: ActiveUser[]
  loading?: boolean
}

/**
 * Generates initials from a user's name (up to 2 characters).
 * Falls back to first letter of email if no name.
 */
function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  return email[0].toUpperCase()
}

/**
 * Generates a consistent color based on name/email for initials background.
 * Uses HSL for pleasant, accessible colors.
 */
function getAvatarColor(name: string | null, email: string): string {
  const str = name || email
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 65%, 45%)`
}

/**
 * Avatar component with image or initials fallback.
 */
function UserAvatar({
  name,
  email,
  image
}: {
  name: string | null
  email: string
  image: string | null
}) {
  const initials = getInitials(name, email)
  const bgColor = getAvatarColor(name, email)

  if (image) {
    return (
      <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
        <Image
          src={image}
          alt={name || email}
          fill
          sizes="40px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0"
      style={{ backgroundColor: bgColor }}
    >
      {initials}
    </div>
  )
}

/**
 * Simple rank indicator - just the number, no medals to avoid office drama!
 */
function RankBadge({ rank }: { rank: number }) {
  return (
    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
      {rank}
    </div>
  )
}

export function MostActiveUsersCard({ users, loading }: MostActiveUsersCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Most Active Users
          </CardTitle>
          <p className="text-sm text-muted-foreground">Top users by activity</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Most Active Users
          </CardTitle>
          <p className="text-sm text-muted-foreground">Top users by activity</p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No activity data yet</p>
            <p className="text-xs mt-1">Activity will appear here once users start interacting with the app</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Most Active Users
        </CardTitle>
        <p className="text-sm text-muted-foreground">Top users by activity</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((user, index) => (
            <div
              key={user.user_id}
              className="p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Rank Badge */}
                <RankBadge rank={index + 1} />

                {/* User Avatar */}
                <UserAvatar
                  name={user.user_name}
                  email={user.user_id}
                  image={user.user_image}
                />

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <div className="font-medium text-sm truncate">
                    {user.user_name || user.user_id}
                  </div>

                  {/* Activity Stats */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {user.login_count > 0 && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 py-0">
                        <LogIn className="h-3 w-3" />
                        {user.login_count}
                      </Badge>
                    )}
                    {user.search_count > 0 && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 py-0">
                        <Search className="h-3 w-3" />
                        {user.search_count}
                      </Badge>
                    )}
                    {user.product_view_count > 0 && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1 py-0">
                        <Eye className="h-3 w-3" />
                        {user.product_view_count}
                      </Badge>
                    )}
                  </div>

                  {/* Last Active */}
                  <p className="text-xs text-muted-foreground mt-1">
                    Active {formatDistanceToNow(new Date(user.last_active), { addSuffix: true })}
                  </p>
                </div>

                {/* Total Events Badge */}
                <Badge className="shrink-0">
                  {user.event_count}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
