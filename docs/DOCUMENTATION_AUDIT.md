# Documentation Audit Report

**Audit Date**: 2026-01-02
**Auditor**: Claude Code
**Purpose**: Identify docs that would benefit from two-layer split (design vs implementation)

---

## Summary

| Priority | Document | Lines | Recommendation |
|----------|----------|-------|----------------|
| **HIGH** | tiles.md | 311 | Split - has both design diagrams and implementation |
| **HIGH** | symbol-generator.md | 276 | Split + fix stale `/planner` reference |
| **MEDIUM** | filters.md | 1162 | Consider split - very large |
| **MEDIUM** | product-display.md | 1410 | Consider split - very large |
| **MEDIUM** | product-search.md | 869 | Consider split - large |
| **LOW** | playground.md | 234 | OK as-is (small, mostly implementation) |
| **LOW** | theming.md | 272 | OK as-is (clean implementation doc) |
| **OK** | case-study.md | 391 | Already follows pattern (links to design doc) |

---

## HIGH Priority

### 1. tiles.md (311 lines)

**Current State**: Mixed design + implementation

**Design Content** (should be in `docs/plans/tiles-design.md`):
- Architecture diagram (lines 14-51) with ASCII art
- Workflow description (lines 199-224)
- Google Drive structure (lines 226-241)

**Implementation Content** (keep in `docs/features/tiles.md`):
- File structure (lines 53-91)
- Environment variables (lines 93-108)
- State management (lines 124-136)
- API endpoints (lines 138-185)
- Troubleshooting (lines 264-295)

**Action**: Extract design content to `docs/plans/tiles-design.md`

---

### 2. symbol-generator.md (276 lines)

**Current State**: Mixed design + implementation, has stale reference

**Issues**:
- Line 4: `**Route**: /planner` → Should reference `/case-study`
- Line 14: "displayed in the Planner" → Should say "Case Study"
- Line 81-84: File paths reference `src/app/planner/` which no longer exists

**Design Content** (should be in `docs/plans/symbol-generator-design.md`):
- Architecture diagram (lines 18-72)
- 2-stage LLM pipeline explanation
- Cost & rate limits (lines 228-243)
- Error handling strategy (lines 244-253)

**Implementation Content** (keep in `docs/features/symbol-generator.md`):
- File structure (lines 75-102)
- External prompt files (lines 104-150)
- Database schema (lines 152-175)
- API endpoints (lines 177-226)
- Environment variables (lines 255-262)

**Action**:
1. Fix stale `/planner` references
2. Extract design content to `docs/plans/symbol-generator-design.md`

---

## MEDIUM Priority

### 3. filters.md (1162 lines)

**Current State**: Very comprehensive but very long

**Observation**: Appears to be a detailed implementation guide with some design decisions embedded. The length makes it harder to navigate.

**Potential Split**:
- Design: UX principles, filter type decisions, facet behavior
- Implementation: Database schema, RPC functions, component details

**Action**: Review for split when next touching filters feature

---

### 4. product-display.md (1410 lines)

**Current State**: Very long specification document

**Observation**: Appears to be a detailed specification. May benefit from splitting into:
- Design: Display rules, layout decisions, visual hierarchy
- Implementation: Component structure, data mapping, rendering logic

**Action**: Review for split when next touching product display

---

### 5. product-search.md (869 lines)

**Current State**: Long search documentation

**Potential Split**:
- Design: Search UX, result ranking philosophy
- Implementation: Search implementation, API reference

**Action**: Review for split when next touching search feature

---

## LOW Priority (OK as-is)

### 6. playground.md (234 lines)

**Current State**: Concise implementation doc with clear structure

**Observation**: Good balance of design overview and implementation. Small enough that splitting would create unnecessary fragmentation.

**Action**: None required

---

### 7. theming.md (272 lines)

**Current State**: Clean implementation reference

**Observation**: Focused on how theming works (implementation). No significant design vision content that needs separation.

**Action**: None required

---

## Already Follows Pattern

### 8. case-study.md (391 lines)

**Current State**: Links to design doc `planner-v2-design.md`

**Observation**: This is the reference example for the two-layer pattern.

**Action**: None required - serves as template

---

## Stale References Found

| File | Line | Issue | Fix |
|------|------|-------|-----|
| symbol-generator.md | 4 | `/planner` route | Change to `/case-study` |
| symbol-generator.md | 14 | "displayed in the Planner" | Change to "Case Study" |
| symbol-generator.md | 81-84 | `src/app/planner/` paths | Update to `src/components/symbols/` |

---

## Recommended Action Plan

### Immediate (Quick Wins)

1. **Fix stale references** in `symbol-generator.md` (5 minutes)

### Next Feature Touch

2. When working on **tiles**: Split `tiles.md` into design + implementation
3. When working on **symbols**: Split `symbol-generator.md` into design + implementation

### Future Consideration

4. **Large docs** (filters, product-display, product-search): Consider splitting during major feature updates

---

## Metrics

| Metric | Value |
|--------|-------|
| Total feature docs | 16 |
| Already follows pattern | 1 (case-study) |
| High priority for split | 2 (tiles, symbol-generator) |
| Medium priority | 3 (filters, product-display, product-search) |
| OK as-is | 10 |

---

**Next Review**: When major feature work touches any of the high/medium priority docs
