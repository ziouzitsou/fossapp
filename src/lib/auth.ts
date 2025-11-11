import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { logEvent } from './event-logger'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Log successful login event
      if (user?.email) {
        await logEvent('login', user.email, {
          provider: account?.provider || 'unknown',
          login_timestamp: new Date().toISOString(),
        })
      }
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
          logout_timestamp: new Date().toISOString(),
        })
      }
    },
  },
  pages: {
    signIn: '/',
  }
}