# Development Roadmap

Internal tracking for planned improvements, tech debt, and future features.

**Last Updated**: 2026-01-03

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

_No high-priority items currently planned._

---

## Tech Debt

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

### AI-Powered Feedback Assistant
- **Status**: `done`
- **Completed**: 2025-12
- **Release**: v1.12.x
- **Description**: Conversational AI bot that guides users through feature requests and bug reports
- **Implementation**:
  - `src/app/api/feedback/chat/route.ts` - streaming chat endpoint
  - `src/components/feedback/feedback-chat-panel.tsx` - chat UI
  - `src/lib/feedback/agent.ts` - Claude-powered agent logic
  - `src/lib/feedback/knowledge-base.ts` - app knowledge for AI context
- **Docs**: [features/feedback-assistant.md](../features/feedback-assistant.md)

### Migrate Products Page Search to Full-Text Search
- **Status**: `done`
- **Completed**: 2025-12
- **Release**: v1.12.x
- **Description**: Replaced ILIKE-based search with `search.search_products_fts` RPC function
- **Implementation**: `packages/products/src/actions/index.ts`
- **Benefit**: 3-5x faster search on 56K+ products

---

## How to Use This Document

1. **Adding items**: Add under appropriate section with status `planned`
2. **Starting work**: Change status to `in-progress`
3. **Completing work**: Move to "Completed" section, update release notes
4. **Quarterly review**: Archive old completed items, reprioritize backlog
