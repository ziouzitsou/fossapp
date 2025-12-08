import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { logEvent } from './event-logger'
import { upsertUserOnLogin } from './user-service'

// Validate required environment variables at module load time
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN

if (!googleClientId || !googleClientSecret) {
  throw new Error('Missing required authentication environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
}

if (!ALLOWED_DOMAIN) {
  throw new Error('ALLOWED_DOMAIN environment variable is required')
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          hd: ALLOWED_DOMAIN, // UI hint (not secure alone)
        },
      },
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // ✅ Server-side domain validation (CRITICAL)
      const email = user?.email

      if (!email) {
        console.warn('Rejected login attempt: missing email')
        return false
      }

      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        console.warn(`Rejected login attempt from unauthorized domain: ${email}`)
        return false
      }

      // Upsert user in database (create on first login, update on subsequent)
      const userRecord = await upsertUserOnLogin(email, user.name, user.image)

      if (!userRecord) {
        console.error('Failed to create/update user record:', email)
        // Allow login anyway - don't block on DB issues
      } else if (!userRecord.is_active) {
        // User has been disabled by admin
        console.warn(`Blocked login attempt from disabled user: ${email}`)
        await logEvent('login_blocked', email, {
          eventData: {
            reason: 'account_disabled',
            timestamp: new Date().toISOString(),
          },
          pathname: '/'
        })
        return '/auth/blocked'
      }

      // Log successful login event
      await logEvent('login', email, {
        eventData: {
          provider: account?.provider || 'unknown',
          login_timestamp: new Date().toISOString(),
          is_new_user: userRecord?.login_count === 1,
          group: userRecord?.group_name,
        },
        pathname: '/'
      })

      return true
    },
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token
      }
      // On initial sign in, fetch user group from database
      if (user?.email) {
        const userRecord = await upsertUserOnLogin(user.email, user.name, user.image)
        if (userRecord) {
          token.group = userRecord.group_name
          token.groupId = userRecord.group_id
        }
      }
      return token
    },
    async session({ session, token }) {
      // Pass group info to session
      if (token.group) {
        session.user.group = token.group as string
        session.user.groupId = token.groupId as number
      }
      return session
    },
  },
  events: {
    async signOut({ session }) {
      // Log logout event
      // Note: session might be null in some cases
      if (session?.user?.email) {
        await logEvent('logout', session.user.email, {
          eventData: {
            logout_timestamp: new Date().toISOString(),
          }
        })
      }
    },
  },
  pages: {
    signIn: '/',
  }
}