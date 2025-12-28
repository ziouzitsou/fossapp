# FOSSAPP Documentation Index

> **Quick Start**: See [CLAUDE.md](../CLAUDE.md) for essential commands and references.

---

## Monorepo (v1.12.4+)

FOSSAPP uses Turborepo with 5 shared packages. **Always check packages before writing new code.**

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../CLAUDE.md) | Package structure, import patterns, key guidelines |
| [monorepo-development-guidelines.md](../.claude/monorepo-development-guidelines.md) | Full development patterns |
| [MIGRATION_PROGRESS.md](../MIGRATION_PROGRESS.md) | Migration history and decisions |
| [monorepo-examples/](./monorepo-examples/) | Example code patterns |

---

## Architecture

How the code is structured and patterns to follow.

| Document | Description |
|----------|-------------|
| [overview.md](./architecture/overview.md) | Code patterns, directory structure, domain organization |
| [components.md](./architecture/components.md) | shadcn/ui patterns, component conventions |
| [api-patterns.md](./architecture/api-patterns.md) | Server actions, REST API routes |

---

## Database

Database schema, search system, and Supabase integration.

| Document | Description |
|----------|-------------|
| [schema.md](./database/schema.md) | PostgreSQL schema overview (items, etim) |
| [advanced-search.md](./database/advanced-search.md) | Faceted search architecture (8,500 words) |
| [multimedia-codes.md](./database/multimedia-codes.md) | BMECat MD codes, Supabase storage, fallbacks |
| [supabase-github.md](./database/supabase-github.md) | Supabase GitHub integration, preview DBs |

---

## Deployment

Production deployment, Docker, and infrastructure.

| Document | Description |
|----------|-------------|
| [checklist.md](./deployment/checklist.md) | **MUST READ** before deploying |
| [docker.md](./deployment/docker.md) | Docker multi-stage build, compose |
| [vps.md](./deployment/vps.md) | VPS setup on platon.titancnc.eu |
| [domain.md](./deployment/domain.md) | Domain configuration, migration guide |
| [beta-strategy.md](./deployment/beta-strategy.md) | Beta deployment strategy |

---

## Features

Feature-specific documentation.

| Document | Description |
|----------|-------------|
| [theming.md](./features/theming.md) | Multi-theme system (OKLch colors, tweakcn) |
| [tiles.md](./features/tiles.md) | Tile Management System (DWG generation) |
| [playground.md](./features/playground.md) | DWG from natural language (LLM + APS) |
| [planner.md](./features/planner.md) | Visual lighting layout planner (upload DWG + place products) |
| [symbol-generator.md](./features/symbol-generator.md) | AutoCAD symbol specs via Vision LLM (experimental) |
| [symbol-classification.md](./features/symbol-classification.md) | Product classification rules (A-P letter codes) |
| [filters.md](./features/filters.md) | Dynamic filters implementation |
| [pwa.md](./features/pwa.md) | Progressive Web App setup |
| [product-search.md](./features/product-search.md) | Product search interface |
| [product-display.md](./features/product-display.md) | Product display specification |
| [google-drive-integration.md](./features/google-drive-integration.md) | Google Drive integration |
| [google-drive-shared.md](./features/google-drive-shared.md) | Shared Drive (HUB) access |
| [user-monitoring.md](./features/user-monitoring.md) | User access analytics |
| [supplier-logos.md](./features/supplier-logos.md) | Supplier logo guidelines |
| [whats-new.md](./features/whats-new.md) | What's New dialog system (releases.json) |
| [project-management/](./features/project-management/) | Project management feature (6 docs) |

---

## Security

Security auditing and tools.

| Document | Description |
|----------|-------------|
| [auditing.md](./security/auditing.md) | Security auditing overview |
| [gemini-auditor.md](./security/gemini-auditor.md) | Gemini AI code auditor setup |

---

## Development

Development workflows and tasks.

| Document | Description |
|----------|-------------|
| [roadmap.md](./development/roadmap.md) | **Planned improvements, tech debt, feature backlog** |
| [tasks.md](./development/tasks.md) | Common development tasks |
| [autolisp-reference.md](./development/autolisp-reference.md) | AutoLISP patterns for DWG generation (DWGUNITS, entmake, APS) |

---

## Archive

Historical and completed migration docs.

| Document | Description |
|----------|-------------|
| [nextjs-16-migration.md](./archive/nextjs-16-migration.md) | Next.js 16 migration (completed) |
| [nextauth-v5-guide.md](./archive/nextauth-v5-guide.md) | NextAuth v5 migration (future) |
| [SHADCN_MIGRATION_TASKS.md](./archive/SHADCN_MIGRATION_TASKS.md) | shadcn migration (completed) |
| [icons_migration.md](./archive/icons_migration.md) | Icons migration (completed) |

---

**Last Updated**: 2025-12-28 (v1.12.5 - Added symbol classification docs)
