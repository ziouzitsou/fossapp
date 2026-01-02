# Development Roadmap

Internal tracking for planned improvements, tech debt, and future features.

**Last Updated**: 2025-12-22

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `planned` | Approved, not started |
| `in-progress` | Currently being worked on |
| `blocked` | Waiting on dependency |
| `done` | Completed (move to changelog) |

---

## High Priority

### AI-Powered Feedback Assistant
- **Status**: `planned`
- **Added**: 2025-12-22
- **Description**: Conversational AI bot that guides users through feature requests and bug reports
- **Concept**: Instead of a static form, users chat with an AI that knows FOSSAPP, asks clarifying questions, and creates structured, actionable feedback
- **User Flow**:
  1. User opens feedback dialog
  2. AI greets and asks what they need help with
  3. AI asks clarifying questions (which page? what happened? what expected?)
  4. AI categorizes and summarizes the feedback
  5. User confirms, AI submits structured ticket
- **Technical Approach**:
  - Claude API with Vercel AI SDK for streaming chat
  - System prompt containing app knowledge (features, pages, known issues)
  - `tool_use` for structured `submit_feedback` output
  - Conversation transcript saved with ticket
- **Database Schema**:
  ```sql
  CREATE TABLE public.user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    type TEXT CHECK (type IN ('bug', 'feature', 'improvement', 'question')),
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location TEXT,  -- page/feature affected
    title TEXT NOT NULL,
    description TEXT,
    steps_to_reproduce TEXT,
    conversation_transcript JSONB,  -- full AI conversation
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- **Components Needed**:
  - `/api/feedback/chat` - streaming chat endpoint
  - `FeedbackBot` component - chat UI in modal/drawer
  - `/dashboard/feedback` - admin view for reviewing tickets
  - System prompt document with app knowledge
- **Effort**: Medium-High
- **Notes**: Great UX, results in higher quality feedback than static forms

---

## Performance Improvements

### Migrate Products Page Search to Full-Text Search
- **Status**: `planned`
- **Added**: 2025-12-22
- **Description**: Replace ILIKE-based search in `searchProductsBasicAction` with the existing `search.search_products_fts` RPC function
- **Current State**:
  - `src/lib/actions/products.ts:90` uses multiple ILIKE patterns (slow)
  - `search.search_products_fts` already exists and is used by tiles search
  - `items.product_search_index` table has `search_vector` tsvector column
- **Benefit**: 3-5x faster search on 56K+ products
- **Effort**: Low (function already exists, just need to switch the action)
- **Files to modify**:
  - `src/lib/actions/products.ts` - `searchProductsBasicAction`

---

## Tech Debt

### Generate Supabase TypeScript Types
- **Status**: `planned`
- **Added**: 2025-12-22
- **Description**: Replace `as unknown as` type assertions with generated types
- **Current Issues**:
  - `src/lib/actions/dashboard.ts:270` - eslint-disable for any
  - `src/lib/actions/projects.ts:693-703` - double cast for joins
  - `src/lib/user-service.ts:75` - type assertion for user_groups
- **Solution**: Run `supabase gen types typescript` and import generated types
- **Effort**: Medium

### Remove Development Console.log Statements
- **Status**: `planned`
- **Added**: 2025-12-22
- **Description**: Replace or remove console.log in production code
- **Locations**:
  - `src/lib/tiles/google-drive-tile-service.ts`
  - `src/lib/tiles/progress-store.ts`
  - `src/components/case-study-viewer/case-study-viewer.tsx`
- **Solution**: Use conditional logging utility or remove entirely
- **Effort**: Low

---

## Future Enhancements

_Items here are ideas, not yet approved for implementation._

### Add Query Timeouts
- **Description**: Add timeout handling to database queries to prevent hanging
- **Example**: `AbortSignal.timeout(10000)` on Supabase calls
- **Effort**: Medium

### Improved Error Messages
- **Description**: More specific user-facing error messages based on PostgreSQL error codes
- **Example**: "A project with this code already exists" instead of generic "Failed to create project"
- **Effort**: Low

---

## Completed

_Move items here when done, then transfer to release notes._

<!--
### Example Completed Item
- **Status**: `done`
- **Completed**: 2025-XX-XX
- **Release**: v1.X.X
-->

---

## How to Use This Document

1. **Adding items**: Add under appropriate section with status `planned`
2. **Starting work**: Change status to `in-progress`
3. **Completing work**: Move to "Completed" section, update release notes
4. **Quarterly review**: Archive old completed items, reprioritize backlog
