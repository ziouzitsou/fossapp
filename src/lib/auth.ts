import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { logEvent } from './event-logger'

// Validate required environment variables at module load time
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

if (!googleClientId || !googleClientSecret) {
  throw new Error('Missing required authentication environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET')
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          hd: process.env.ALLOWED_DOMAIN || 'foss.gr', // UI hint (not secure alone)
        },
      },
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // ✅ Server-side domain validation (CRITICAL)
      const allowedDomain = process.env.ALLOWED_DOMAIN || 'foss.gr'
      const email = user?.email

      if (!email || !email.endsWith(`@${allowedDomain}`)) {
        console.warn(`Rejected login attempt from: ${email || 'unknown'}`)
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