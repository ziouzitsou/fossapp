# FOSSAPP - Lighting Design Product Database

A comprehensive Next.js application for lighting professionals, architects, and designers to search, browse, and manage lighting products for AutoCAD and lighting design projects.

## Overview

FOSSAPP provides access to a comprehensive database of 56,456+ lighting products and accessories from leading manufacturers like Delta Light. Designed specifically for professionals working on lighting studies, AutoCAD projects, and architectural lighting design.

## Features

### Product Database
- **Comprehensive Product Search** - Search through 56,456+ lighting fixtures and accessories
- **Advanced Filtering** - Filter by supplier, product type, features, and specifications
- **Detailed Product Information** - Full specifications, features, pricing, and multimedia content
- **ETIM Classification** - Industry-standard product classification system
- **Real-time Data** - Connected to live Supabase database with up-to-date product information

### Authentication & User Management
- **Google OAuth Authentication** - Secure login with Google accounts
- **User Profiles** - Personalized user experience and preferences
- **Protected Routes** - Secure access to product data and features

### Design & UX
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- **Modern UI** - Clean interface built with Tailwind CSS and Radix UI components
- **Professional Dashboard** - Intuitive layout designed for professional workflows
- **Fast Search** - Optimized search with instant results and pagination

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Google Cloud Console project set up
- Google OAuth 2.0 credentials
- Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ziouzitsou/fossapp.git
   cd fossapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure environment variables in `.env.local`:
   ```
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
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
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth.js API routes
│   │   └── products/            # Product API endpoints
│   ├── dashboard/               # Main application dashboard
│   ├── products/               # Product pages and search
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # Reusable UI components (Radix UI)
│   └── providers.tsx           # Session provider wrapper
└── lib/
    ├── auth.ts                 # NextAuth configuration
    ├── supabase.ts            # Client-side Supabase connection
    ├── supabase-server.ts     # Server-side Supabase connection
    └── actions.ts             # Server actions for data fetching
```

## Database Schema

The application connects to a Supabase PostgreSQL database with the following key schemas:

- **items.product_info** - Main product catalog (materialized view)
  - 56,456+ lighting products and accessories
  - Product specifications, pricing, multimedia content
  - Supplier information and categorization
  
- **etim** - ETIM classification system
  - Industry-standard product classification
  - Hierarchical categorization of lighting products

## API Endpoints

- `GET /api/products/search?q=<term>` - Search products (max 50 results)
- `GET /api/products/[id]` - Get detailed product information
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication endpoints

## Technologies Used

- **Next.js 15.3.4** - React framework with App Router
- **NextAuth.js** - Authentication library with Google OAuth
- **Supabase** - PostgreSQL database and backend services
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible, unstyled UI components
- **React Icons** - Comprehensive icon library

## Security Features

- **CSRF Protection** - Built-in NextAuth.js security
- **SQL Injection Prevention** - Parameterized queries with Supabase
- **Environment Variable Protection** - Secure secret management
- **Role-based Database Access** - Separate anon/service role permissions
- **Protected Routes** - Authentication-required pages
- **Secure Cookie Handling** - HTTP-only, secure cookies

## Development

### Running the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # ESLint code checking
npm run start    # Start production server
```

### Database Development

The application uses Supabase with the following exposed schemas:
- `public` - NextAuth.js tables
- `items` - Product catalog (read-only)
- `etim` - ETIM classification (read-only)

## Roadmap

### Phase 1 - Core Features ✅
- [x] Product search and display
- [x] Google OAuth authentication
- [x] Responsive design
- [x] Database integration
- [x] Docker containerization
- [x] VPS deployment with blue-green strategy
- [x] Version display with environment awareness
- [x] Health monitoring and log rotation

### Phase 2 - Enhanced Features (Planned)
- [ ] Advanced product filtering
- [ ] User favorites and wishlist
- [ ] Project management tools
- [ ] Product comparison
- [ ] Export to AutoCAD formats
- [ ] Advanced search with ETIM classification
- [ ] User product history

### Phase 3 - Professional Tools (Future)
- [ ] Lighting calculation tools
- [ ] Project collaboration
- [ ] Custom product catalogs
- [ ] Integration with design software
- [ ] Advanced reporting

## Contributing

This is a private project for lighting design professionals. For issues or feature requests, please contact the maintainer.

## License

Private - All rights reserved