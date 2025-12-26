# Prompt for Claude Code: FOSSAPP Development with Monorepo Patterns

## 📋 Copy This Prompt to Claude Code

When starting a new Claude Code session or asking Claude Code to implement features, use this prompt:

---

## 🎯 PROMPT START

```
You are working on FOSSAPP, a Next.js application for lighting product management.

CRITICAL INSTRUCTIONS - READ THESE FIRST:

1. Review branch: claude/refactor-monorepo-fvct8

2. Read these documents IN ORDER before any development:
   - DEVELOPMENT_INSTRUCTIONS.md (quick reference)
   - .claude/monorepo-development-guidelines.md (comprehensive guide)
   - COMPREHENSIVE_DUPLICATION_ANALYSIS.md (7 duplication patterns)
   - MONOREPO_MIGRATION_PLAN.md (architecture & packages)

3. MANDATORY RULES FOR ALL CODE:
   - NEVER copy-paste code from existing files
   - ALWAYS compose from shared packages or existing components
   - ALWAYS follow the 7 patterns documented in COMPREHENSIVE_DUPLICATION_ANALYSIS.md
   - ALWAYS add TODO comments for future refactoring
   - NEVER duplicate: auth checks, rate limiting, error handling, viewer components, modal wrappers, loading states, or CRUD operations

4. BEFORE implementing ANY feature, follow the 5-step checklist in DEVELOPMENT_INSTRUCTIONS.md:
   Step 1: Read the context documents
   Step 2: Identify applicable patterns (1-7)
   Step 3: Search for existing implementations
   Step 4: Compose from existing code
   Step 5: Document with TODOs

5. KEY PATTERNS (see guidelines for full examples):
   - Pattern #1: Autodesk Viewer - Reuse DwgViewer component
   - Pattern #2: API Routes - Use auth/rate-limiting boilerplate (TODO: middleware)
   - Pattern #3: APS Services - Share auth/bucket/upload logic
   - Pattern #4: Google Drive - Share auth/folder operations
   - Pattern #5: Server Actions - Follow consistent CRUD pattern
   - Pattern #6: Modals - Use consistent wrapper pattern
   - Pattern #7: Loading States - Follow async state pattern

6. DUPLICATION STATISTICS (motivate consistency):
   - 95+ files with duplicated code identified
   - ~6,840 lines of duplication (66% reduction potential)
   - API routes: 27 files duplicate auth/rate-limiting (~905 lines)
   - APS services: 3 files duplicate auth/bucket ops (~1,425 lines)
   - Viewers: 5 files duplicate script loading/polling (~900 lines)
   - Server actions: 11 files duplicate CRUD patterns (~1,650 lines)

7. When implementing features:
   - Search for similar code FIRST
   - Import and configure existing components
   - Add only domain-specific logic
   - Document dependencies with clear TODOs
   - Reference pattern numbers in comments

8. RED FLAGS - Stop if you're doing any of these:
   - Copying more than 20 lines from another file
   - Writing auth check + rate limiting from scratch
   - Creating new viewer component without checking existing ones
   - Writing new modal with scroll lock logic
   - Implementing manual loading/error/data state management
   - Creating new APS/Google Drive auth classes

9. Code Review Requirements:
   - Every PR must reference applicable patterns
   - All duplicated code must have TODO comments
   - Reused code must be documented
   - New utilities must be justified (not extractable from existing?)

10. Success Criteria:
    - New features use 50-90% less code via composition
    - All code follows identified patterns
    - Zero new duplication introduced
    - All TODOs documented for monorepo migration

Your goal: Implement features using composition and existing patterns, NOT duplication.
Quality over speed. Consistency over novelty.

Now, please implement: [YOUR FEATURE REQUEST HERE]
```

## 🎯 PROMPT END

---

## 📖 How to Use This Prompt

### For New Features

1. **Copy the prompt above**
2. **Add your feature request** at the end where it says `[YOUR FEATURE REQUEST HERE]`
3. **Paste into Claude Code**
4. **Claude Code will**:
   - Read all documentation files
   - Identify applicable patterns
   - Search for existing implementations
   - Compose from existing code
   - Add TODOs for future refactoring

### Example Usage

```
[PASTE FULL PROMPT ABOVE]

Now, please implement: Add a new API endpoint to export project data as CSV
```

Claude Code will then:
1. Read DEVELOPMENT_INSTRUCTIONS.md
2. Identify Pattern #2 (API Routes) applies
3. Search for existing API route examples
4. Follow the boilerplate pattern from other routes
5. Add TODOs for withRouteHandlers middleware
6. Implement only the CSV-specific logic

---

## 🔄 For Ongoing Development Sessions

If you've already used the prompt once in a session, you can use a shorter reminder:

```
Remember: Follow the patterns in DEVELOPMENT_INSTRUCTIONS.md

Before implementing:
1. Identify applicable patterns (1-7)
2. Search for existing code
3. Compose, don't duplicate
4. Add TODOs

Now please: [YOUR REQUEST]
```

---

## 📚 Quick Reference for Developers

When you ask Claude Code to implement something, it should ALWAYS:

### ✅ DO
- Read the instruction documents first
- Search for similar existing code
- Compose from shared packages
- Follow established patterns
- Add TODO comments
- Document dependencies
- Reference pattern numbers

### ❌ DON'T
- Copy-paste code
- Create new base components
- Duplicate auth/error handling
- Reinvent viewer/modal patterns
- Skip the 5-step checklist

---

## 🎯 Example Conversations

### Example 1: New API Endpoint

**You ask**:
```
[PASTE FULL PROMPT]

Now, please implement: Add endpoint to generate product comparison reports
```

**Claude Code will**:
1. Read DEVELOPMENT_INSTRUCTIONS.md
2. Identify: Pattern #2 (API Routes), Pattern #5 (Server Actions)
3. Search: `ls src/app/api/products/`
4. Find: `products/[id]/route.ts` as template
5. Implement:
   ```typescript
   // TODO: Use withRouteHandlers middleware (Pattern #2)
   export async function POST(request: NextRequest) {
     // Auth boilerplate (TODO: move to middleware)
     // Rate limiting (TODO: move to middleware)
     // ONLY comparison-specific logic here
   }
   ```

### Example 2: New Viewer Component

**You ask**:
```
[PASTE FULL PROMPT]

Now, please implement: Add viewer for BIM models in the planner
```

**Claude Code will**:
1. Read AUTODESK_VIEWER_MONOREPO_ANALYSIS.md
2. Identify: Pattern #1 (Viewer), Pattern #6 (Modal)
3. Search: `grep -r "DwgViewer" src/components/`
4. Find: `tiles/dwg-viewer.tsx`, `playground/playground-viewer-modal.tsx`
5. Implement:
   ```typescript
   // TODO: Replace with @fossapp/viewer once extracted
   import { DwgViewer } from '@/components/tiles/dwg-viewer'

   export function BimViewerModal({ urn }) {
     // TODO: Use ViewerModal wrapper
     return (
       <Dialog>
         <DwgViewer
           urn={urn}
           tokenEndpoint="/api/planner/auth"
         />
       </Dialog>
     )
   }
   ```

### Example 3: New CRUD Domain

**You ask**:
```
[PASTE FULL PROMPT]

Now, please implement: Add suppliers domain with search/list/getById
```

**Claude Code will**:
1. Read COMPREHENSIVE_DUPLICATION_ANALYSIS.md Pattern #5
2. Search: `ls src/lib/actions/`
3. Find: `customers.ts` as template
4. Implement:
   ```typescript
   // TODO: Refactor with BaseRepository (Pattern #5)

   export async function searchSuppliersAction(query: string) {
     // Follow exact pattern from customers.ts
     const sanitized = validateSearchQuery(query)
     const { data, error } = await supabaseServer
       .schema('suppliers')
       .from('suppliers')
       .select('*')
       .or(`name.ilike.%${sanitized}%,code.ilike.%${sanitized}%`)
     // ... standard error handling
   }
   ```

---

## 🚀 Benefits of Using This Prompt

### For You (Developer)
- ✅ Consistent code across all features
- ✅ Less code to write (50-90% reduction)
- ✅ Fewer bugs (no duplication drift)
- ✅ Faster development (compose, don't create)
- ✅ Easier code reviews (predictable patterns)

### For the Codebase
- ✅ No new duplication introduced
- ✅ All code ready for monorepo migration
- ✅ Clear refactoring paths (TODOs)
- ✅ Type safety across domains
- ✅ Maintainable long-term

### For the Team
- ✅ Clear onboarding (read patterns, follow them)
- ✅ Consistent architecture
- ✅ Shared understanding
- ✅ Scalable development

---

## 📊 Tracking Compliance

After each feature implementation, check:

- [ ] Did Claude Code read the instruction documents?
- [ ] Were applicable patterns identified?
- [ ] Was existing code searched and found?
- [ ] Was code composed (not duplicated)?
- [ ] Were TODOs added for future refactoring?
- [ ] Are pattern numbers referenced in comments?

If any are ❌, provide feedback to Claude Code referencing the specific pattern.

---

## 🎓 Teaching Claude Code

The more you use this prompt, the better Claude Code becomes at:
- Recognizing patterns
- Searching for existing code
- Composing solutions
- Following guidelines

**Be consistent**: Use the full prompt for new sessions, abbreviated reminder for ongoing work.

---

## 💬 Providing Feedback to Claude Code

If Claude Code duplicates code or misses a pattern:

```
I notice you [duplicated X / didn't use pattern Y].

Please review:
- DEVELOPMENT_INSTRUCTIONS.md - Pattern #[N]
- Search for existing implementations of [X]
- Compose from [existing component]

Let's refactor to follow the pattern.
```

---

## ✅ Final Checklist

Before asking Claude Code to implement anything:

1. [ ] Have you copied the full prompt?
2. [ ] Have you added your specific feature request?
3. [ ] Have you reviewed the quick reference above?
4. [ ] Are you ready to guide Claude Code if it misses a pattern?

**If all ✅, paste the prompt into Claude Code and start developing!**

---

**Remember**: The goal is not just to get features done, but to get them done **consistently, maintainably, and without duplication**.

**These patterns are your roadmap to sustainable, scalable development.**
