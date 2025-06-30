# Google Auth App

A Next.js application with Google OAuth authentication featuring a modern dashboard interface.

## Features

- **Google OAuth Authentication** - Secure login with Google accounts
- **Responsive Design** - Works on desktop and mobile devices
- **Modern UI** - Clean interface with Tailwind CSS
- **Dashboard Layout** - Professional layout with sidebar navigation
- **User Profile** - Display user information and profile picture
- **Protected Routes** - Secure access to dashboard content

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Google Cloud Console project set up
- Google OAuth 2.0 credentials

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your Google OAuth credentials in `.env.local`:
   ```
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy the Client ID and Client Secret to your `.env.local` file

### Running the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
src/
├── app/
│   ├── api/auth/[...nextauth]/
│   │   └── route.ts          # NextAuth.js API routes
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard page
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Landing page
├── components/
│   └── providers.tsx         # Session provider wrapper
└── lib/
    └── auth.ts               # NextAuth configuration
```

## Authentication Flow

1. **Landing Page** - Users see a "Sign in with Google" button
2. **Google OAuth** - Users authenticate with their Google account
3. **Welcome Screen** - Authenticated users see their profile info
4. **Dashboard** - Users can enter the main application

## Technologies Used

- **Next.js 14** - React framework with App Router
- **NextAuth.js** - Authentication library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Icons** - Icon library

## Security Features

- CSRF protection
- Secure cookie handling
- Environment variable protection
- Protected routes middleware

## Development

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.