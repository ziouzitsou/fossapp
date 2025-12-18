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
- Access to team credentials (via 1Password/Bitwarden shared vault)

### Quick Start

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

4. Get credentials from team vault and fill in `.env.local`:
   - All required variables are documented in `.env.example`
   - See sections below for details on each service

5. (Optional) Set up Google Drive integration:
   ```bash
   mkdir -p credentials
   # Copy google-service-account.json from team vault to credentials/
   ```

6. Run the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:8080](http://localhost:8080)

### Required Services & Credentials

| Service | What you need | Where to get it |
|---------|---------------|-----------------|
| **Supabase** | Anon key, Service role key | Team vault or [Supabase Dashboard](https://supabase.com/dashboard) |
| **Google OAuth** | Client ID, Client Secret | Team vault or [GCP Console](https://console.cloud.google.com/) |
| **NextAuth** | Secret key | Generate: `openssl rand -base64 32` |

### Optional Services (for specific features)

| Service | Feature | What you need |
|---------|---------|---------------|
| **Google Drive** | Projects management | Service account JSON in `credentials/` |
| **APS (Autodesk)** | Tile generation, DWG viewing | Client ID, Secret, Activity config |
| **OpenRouter** | Playground LLM | API key |

### Claude Code Setup (Optional)

If using Claude Code for development:
```bash
cp .mcp.json.template .mcp.json
# Fill in your API keys (or get from team vault)
```

### Running the Application

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) to view the application.

### Development without full credentials

You can run the app with minimal setup:
- Products, Tiles viewing, Symbols work with just Supabase credentials
- Google Drive features require the service account
- Tile generation requires APS credentials

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

- **Next.js 16** - React framework with App Router + Turbopack
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

Open [http://localhost:8080](http://localhost:8080) to view the application.

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
- [x] VPS deployment
- [x] Health monitoring

### Phase 2 - Enhanced Features ✅
- [x] Advanced product filtering
- [x] Tiles system (AutoCAD tile generation)
- [x] Symbol generator
- [x] Project management with Google Drive integration
- [x] DWG viewer (APS Model Derivative)
- [x] Playground (LLM-assisted queries)
- [x] PWA support

### Phase 3 - Professional Tools (In Progress)
- [x] Floor plan viewer (Planner)
- [ ] Product placement on floor plans
- [ ] Lighting calculations
- [ ] Project collaboration
- [ ] Export to AutoCAD formats

## Contributing

This is a private project for lighting design professionals. For issues or feature requests, please contact the maintainer.

## License

Private - All rights reserved