import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { logEvent } from './event-logger'

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

      // Log successful login event
      await logEvent('login', email, {
        eventData: {
          provider: account?.provider || 'unknown',
          login_timestamp: new Date().toISOString(),
        },
        pathname: '/'
      })

      return true
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session }) {
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