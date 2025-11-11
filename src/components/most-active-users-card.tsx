'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Search, Eye, LogIn } from 'lucide-react'
import { ActiveUser } from '@/lib/actions'
import { formatDistanceToNow } from 'date-fns'

interface MostActiveUsersCardProps {
  users: ActiveUser[]
  loading?: boolean
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Rank Badge */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm flex-shrink-0">
                    {index + 1}
                  </div>

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate mb-1">
                      {user.user_id}
                    </div>

                    {/* Activity Stats */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.login_count > 0 && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <LogIn className="h-3 w-3" />
                          {user.login_count} login{user.login_count !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {user.search_count > 0 && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Search className="h-3 w-3" />
                          {user.search_count} search{user.search_count !== 1 ? 'es' : ''}
                        </Badge>
                      )}
                      {user.product_view_count > 0 && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {user.product_view_count} view{user.product_view_count !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    {/* Last Active */}
                    <p className="text-xs text-muted-foreground">
                      Last active {formatDistanceToNow(new Date(user.last_active), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Total Events Badge */}
                <Badge className="flex-shrink-0">
                  {user.event_count} event{user.event_count !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
