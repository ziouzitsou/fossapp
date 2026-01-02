# Documentation Guidelines

Guidelines for writing and organizing FOSSAPP documentation.

**Last Updated**: 2026-01-02

---

## Two-Layer Documentation Principle

Feature documentation should be split into two distinct layers:

### Layer 1: Design Documents (`docs/plans/`)

**Purpose**: Capture the *why* and *what* - vision, user workflows, UX principles.

**Contents**:
- Feature vision and goals
- Target users and use cases
- User workflow diagrams (ASCII art)
- UI wireframes and layouts
- UX principles and design decisions
- Development phases and milestones

**Characteristics**:
- Stable after initial design phase
- Rarely changes once feature is implemented
- Serves as reference for future enhancements
- Useful for onboarding new developers to understand intent

**Example**: `docs/plans/planner-v2-design.md`

### Layer 2: Implementation Documents (`docs/features/`)

**Purpose**: Capture the *how* - code structure, APIs, technical details.

**Contents**:
- File structure and module organization
- State management patterns
- Server actions and API reference
- Database schema
- Type definitions
- Configuration options
- Development status and TODOs

**Characteristics**:
- Evolves with the code
- Updated during development
- Technical reference for day-to-day work
- Should mirror actual code structure

**Example**: `docs/features/case-study.md`

---

## When to Use Each Layer

| Scenario | Document Type |
|----------|---------------|
| Planning a new feature | Create design doc first |
| Starting implementation | Create implementation doc |
| Changing UX flow | Update design doc |
| Adding new components | Update implementation doc |
| Refactoring code structure | Update implementation doc |
| Explaining *why* a decision was made | Design doc |
| Explaining *how* something works | Implementation doc |

---

## Cross-Referencing

Always link between the two layers:

**In design docs:**
```markdown
> **Implementation**: See [../features/feature-name.md](../features/feature-name.md) for code structure and technical details.
```

**In implementation docs:**
```markdown
**Design Document**: See [../plans/feature-design.md](../plans/feature-design.md) for UX principles and wireframes.
```

---

## Document Structure Templates

### Design Document Template

```markdown
# Feature Name - Design Document

> **Note**: For implementation details, see [../features/feature-name.md]

**Status:** Planning | In Development | Complete
**Created:** YYYY-MM-DD
**Route:** `/route-path`

---

## 1. Vision
> What problem does this solve? Why does it exist?

## 2. Target Users
| User Type | Technical Level | Primary Goal |

## 3. User Workflow
Step-by-step flow with ASCII diagrams

## 4. Page Layout
ASCII wireframes for each view/state

## 5. UX Principles
Key design decisions and rationale

## 6. Development Phases
| Phase | Description | Status |

## 7. References
Links to related features/docs
```

### Implementation Document Template

```markdown
# Feature Name

**Status:** Active Development | Stable | Deprecated
**Route:** `/route-path`
**Last Updated:** YYYY-MM-DD

---

## Overview
Brief description (2-3 sentences)

**Design Document**: See [../plans/feature-design.md] for UX principles.

## Quick Reference
| Item | Value |
|------|-------|
| Entry Point | `src/app/feature/page.tsx` |
| State Hook | `src/app/feature/hooks/use-feature.ts` |
| Server Actions | `src/app/feature/actions/index.ts` |

## File Structure
```
src/app/feature/
├── page.tsx
├── components/
└── hooks/
```

## State Management
Key hooks and their responsibilities

## Server Actions
API reference with function signatures

## Database Schema
Relevant tables and relationships

## Development Status
- [x] Completed items
- [ ] In progress items
- [ ] Planned items

## Related Documentation
Links to related features
```

---

## Incremental Adoption

You don't need to refactor all existing docs at once:

1. **New features**: Follow the two-layer pattern from the start
2. **Existing features**: Split when you're already touching the feature
3. **Reference example**: Use `case-study.md` + `planner-v2-design.md` as templates

---

## File Naming Conventions

| Type | Location | Naming |
|------|----------|--------|
| Design docs | `docs/plans/` | `feature-name-design.md` |
| Implementation docs | `docs/features/` | `feature-name.md` |
| Archived docs | `docs/archive/` | `feature-name-legacy.md` |

---

## Keeping Docs Current

### When to Update

| Event | Action |
|-------|--------|
| Code refactor | Update implementation doc file structure |
| New component added | Add to implementation doc |
| Schema change | Update database section |
| UX flow change | Update design doc (rare) |
| Feature deprecated | Move to archive with notice |

### Signs Docs Are Stale

- File paths that don't exist
- Function names that have changed
- Features described that were removed
- "TODO" items that are done
- Development phases marked "in progress" that finished

---

## Example: Case Study Feature

**Design Doc**: `docs/plans/planner-v2-design.md`
- Vision and user workflow
- ASCII wireframes for Products and Viewer views
- UX principles ("No Dead Ends", "AutoCAD Familiarity")
- Development phases

**Implementation Doc**: `docs/features/case-study.md`
- File structure matching `src/app/case-study/`
- State management with `useCaseStudyState` hook
- Server actions reference
- Database schema
- Coordinate systems explanation

This split allows:
- Designers to reference UX principles without code details
- Developers to find technical info quickly
- Both layers to evolve at their natural pace
