# Gemini Security Audit - 2025-11-11

This document outlines the findings of a security audit conducted by Gemini on the FOSSApp application.

## Summary of Findings

| Severity | Finding                               | Location                                                              |
| :------- | :------------------------------------ | :-------------------------------------------------------------------- |
| Critical | Insecure Authentication               | `src/app/api/auth/[...nextauth]/route.ts`                             |
| High     | Lack of Database-Level Authorization  | `src/lib/supabase-server.ts`, `src/lib/actions.ts`                    |
| Medium   | Information Disclosure in API         | `src/app/api/products/search/route.ts`, `src/app/api/products/[id]/route.ts` |
| Low      | Information Disclosure in Health Check| `src/app/api/health/route.ts`                                         |
| Low      | Potential for SQL Injection         | `src/lib/actions.ts` (`getActiveCatalogsFallback`)                    |

## Detailed Findings

### 1. Critical: Insecure Authentication

The NextAuth.js configuration in `src/app/api/auth/[...nextauth]/route.ts` does not use the `authOptions` from `src/lib/auth.ts`. This is a critical vulnerability because the `authOptions` contain the logic for domain validation, which is intended to restrict access to users with a specific email domain.

**Impact:** Any user with a Google account can log in to the application, bypassing the intended access controls.

**Recommendation:** Modify `src/app/api/auth/[...nextauth]/route.ts` to import and use the `authOptions` from `src/lib/auth.ts`.

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth'
import NextAuth from 'next-auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### 2. High: Lack of Database-Level Authorization (RLS)

The application uses a Supabase client with service role privileges (`supabaseServer`) to access the database. This client bypasses any Row Level Security (RLS) policies. The application's authorization logic is not being enforced at the database level.

**Impact:** If an attacker finds a way to bypass the application's authentication and authorization checks, they will have unrestricted access to the data in the database.

**Recommendation:** Implement Row Level Security (RLS) on all tables that contain sensitive data. Modify the application to use a user-specific Supabase client when accessing the database, so that RLS policies are enforced. The service role key should only be used for administrative tasks that require bypassing RLS.

### 3. Medium: Information Disclosure in API Endpoints

The `/api/products/search` and `/api/products/[id]` endpoints are not authenticated. This means that anyone can search for and view products. The same applies to the dashboard, supplier, family, and catalog statistics actions in `lib/actions.ts`.

**Impact:** If the product data is considered sensitive, this could be a significant information disclosure vulnerability.

**Recommendation:** Add authentication checks to all API endpoints and server actions that expose sensitive data. Use `getServerSession(authOptions)` to get the user's session and only return data if the user is authenticated.

### 4. Low: Information Disclosure in Health Check

The `/api/health` endpoint exposes the application version and Node.js environment.

**Impact:** This is a low-level information disclosure that could provide an attacker with information about the application's technology stack.

**Recommendation:** Consider removing the version and environment information from the health check response, or restricting access to this endpoint.

### 5. Low: Potential for SQL Injection in `getActiveCatalogsFallback`

The `getActiveCatalogsFallback` function in `lib/actions.ts` uses a raw SQL query. While it seems safe in its current implementation, it's a bad practice and could be a vector for SQL injection if the input is not properly sanitized.

**Impact:** A successful SQL injection attack could allow an attacker to read, modify, or delete data in the database.

**Recommendation:** Avoid using raw SQL queries whenever possible. If you must use a raw query, ensure that all input is properly sanitized. In this case, the query can be rewritten to not use raw SQL.
