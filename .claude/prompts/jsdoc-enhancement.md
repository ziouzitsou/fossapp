# JSDoc Enhancement Pass for FOSSAPP

**Purpose**: Systematic JSDoc documentation enhancement to improve developer experience and AI agent comprehension.

**Created**: 2026-01-02
**Estimated Sessions**: 3-4 (split by area to stay within context limits)

---

## Session Selection

Choose ONE focus area per session:

- [ ] **Session 1**: Core packages (`packages/core/`, `packages/ui/`)
- [ ] **Session 2**: Feature packages (`packages/products/`, `packages/tiles/`, `packages/projects/`)
- [ ] **Session 3**: Server actions (`src/lib/actions/`) and utilities (`src/lib/`)
- [ ] **Session 4**: Feature components (`src/components/`, `src/app/*/components/`)

---

## What To Document

### File-Level (top of each .ts/.tsx file)

```typescript
/**
 * [Module Name] - [One-line purpose]
 *
 * [2-3 sentences explaining what this module does, when it's used,
 * and how it fits into the larger system]
 *
 * @module [optional: for complex modules]
 * @see {@link [related-file.ts]} [optional: key relationships]
 */
```

### Functions/Hooks

```typescript
/**
 * [What it does in one line]
 *
 * @remarks
 * [Optional: Non-obvious behavior, edge cases, or "why" explanation]
 *
 * @param paramName - [Description, include units/format if relevant]
 * @returns [What's returned and when it might be null/undefined]
 * @throws [If it can throw, describe when]
 *
 * @example
 * [Optional: For complex functions, show usage]
 *
 * @see {@link [external-doc-url]} [Optional: For external APIs]
 */
```

### Interfaces/Types

```typescript
/**
 * [What this type represents]
 *
 * @remarks
 * [When to use this vs similar types, or important constraints]
 */
interface Example {
  /** [Property description - keep on one line if short] */
  shortProp: string

  /**
   * [Longer property description that needs
   * multiple lines to explain properly]
   */
  complexProp: SomeType
}
```

---

## Guidelines

1. **Read before writing** - Understand the file's role before documenting
2. **Focus on "why" not "what"** - Code shows what, docs explain why
3. **Domain terminology** - Define FOSSAPP-specific terms (ETIM, symbols, tiles, placements, etc.)
4. **Cross-references** - Link related files with `@see`
5. **External APIs** - Reference Supabase, APS/Forge, ETIM docs where relevant
6. **Skip trivial code** - Don't document obvious getters/setters
7. **Preserve existing good docs** - Enhance, don't replace good JSDoc

---

## Priority Order (within each session)

1. **Exported functions** - Public API surface
2. **Complex logic** - Anything with transformations, calculations, state machines
3. **Domain-specific code** - ETIM classification, coordinate transforms, symbol generation
4. **Integration points** - API routes, server actions, database queries

---

## Output Expectations

- Edit files in-place using the Edit tool
- Group related files (finish one module before moving to next)
- After each major file, briefly note what you documented
- If you hit context limits, stop cleanly and list remaining files

---

## Do NOT

- Add JSDoc to every single line
- Create separate documentation files (keep docs in code)
- Change any logic or refactor code
- Add comments inside function bodies (only JSDoc at declarations)

---

## Session Estimates

| Session | Files | Est. Tokens | Time |
|---------|-------|-------------|------|
| 1. Core packages | ~40 files | 80-100K | 30 min |
| 2. Feature packages | ~30 files | 60-80K | 25 min |
| 3. Server actions/lib | ~50 files | 100-120K | 35 min |
| 4. Components | ~60 files | 120-150K | 40 min |

---

## Start Command

Begin by listing the files in the session's focus area:

```bash
# Session 1
find packages/core packages/ui -name "*.ts" -o -name "*.tsx" | head -50

# Session 2
find packages/products packages/tiles packages/projects -name "*.ts" -o -name "*.tsx" | head -50

# Session 3
find src/lib -name "*.ts" | head -50

# Session 4
find src/components src/app -path "*/components/*" -name "*.tsx" | head -50
```

Then prioritize by file size (`wc -l`) and start with the largest/most complex files.

---

## Example Output

After documenting a file, note it briefly:

```
✓ packages/core/src/db/server.ts - Added module doc, documented createClient params
✓ packages/core/src/logging/logger.ts - Added @remarks for log levels, @example for usage
```

---

## Related

- **Standard reference**: `.claude/skills/coding-patterns/SKILL.md` (JSDoc section)
- **Hook example**: `src/components/case-study-viewer/hooks/` (well-documented hooks)
