# FOSSAPP - Product Search Application

## Project Overview
Next.js application for searching and displaying lighting products from Delta Light and other suppliers. Connects to real Supabase database with 56,456+ products.

## Architecture
- **Frontend**: Next.js 15.3.4 with App Router
- **Authentication**: NextAuth.js with Google OAuth
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS with Radix UI components
- **Deployment**: Development server

## Database Schema
- **Main Table**: `items.product_info` (materialized view)
- **Secondary Schema**: `etim` (ETIM classification data)
- **Product Fields**: product_id, foss_pid, description_short, description_long, supplier_name, prices, multimedia, features
- **Suppliers**: Primarily Delta Light lighting products

## Security Implementation ✅
- **Environment Variables**: All secrets moved to `.env.local`
- **Parameterized Queries**: No SQL injection vulnerabilities
- **Service Role**: Server actions use `supabaseServer` with service_role key
- **Client Role**: Browser operations use `supabase` with anon key
- **Input Validation**: All user inputs sanitized and validated
- **Schema Permissions**: `items` and `etim` schemas exposed with proper role permissions

## Key Files
- `src/lib/supabase.ts` - Client-side Supabase connection (anon key)
- `src/lib/supabase-server.ts` - Server-side Supabase connection (service role)
- `src/lib/actions.ts` - Server actions for product search and details
- `src/app/api/products/search/route.ts` - Product search API endpoint
- `src/app/api/products/[id]/route.ts` - Product details API endpoint

## Environment Variables Required
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<secret-key>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
```

## Supabase Configuration
- **Project Ref**: hyppizgiozyyyelwdius
- **Exposed Schemas**: public, extensions, items, etim
- **Permissions Granted**: 
  - `GRANT USAGE ON SCHEMA items TO service_role;`
  - `GRANT SELECT ON items.product_info TO service_role;`
  - `GRANT USAGE ON SCHEMA items TO anon;`
  - `GRANT SELECT ON items.product_info TO anon;`

## API Endpoints Working ✅
- **Search**: `GET /api/products/search?q=<term>` - Returns max 50 products
- **Details**: `GET /api/products/<product-id>` - Returns full product info
- **Auth**: NextAuth endpoints for Google OAuth

## Development Commands
```bash
npm run dev     # Start development server on :3000
npm run build   # Production build
npm run lint    # ESLint check
```

## Testing Verified ✅
- Product search works with real data (tested: "SOLI", "LED", "entero", "delta", "frax", "super")
- Product details page displays full information including features, multimedia, pricing
- Authentication flow functional
- All security measures implemented and tested

## Known Issues
- OAuth callback has state cookie issue in WSL2 environment
- CORS warning for cross-origin requests (can be configured in next.config.js)

## Future Enhancements
- Add filters for product categories, suppliers, price ranges
- Implement product comparison feature
- Add product image gallery
- Implement user favorites/wishlist
- Add advanced search with ETIM classification filters

## Version Display
- **Location**: Bottom of sidebar navigation 
- **Development**: Shows `v1.1.1-dev` 
- **Production**: Shows `v1.1.1` 
- **Purpose**: Environment awareness and deployment verification

## Deployment Status
- **VPS**: platon.titancnc.eu (deployed via Docker)
- **Domain**: https://app.titancnc.eu
- **Current Version**: v1.1.1
- **Health Check**: https://app.titancnc.eu/api/health

## Last Updated
Project enhanced with version display and deployed to production on July 1, 2025. Full Docker deployment pipeline operational.