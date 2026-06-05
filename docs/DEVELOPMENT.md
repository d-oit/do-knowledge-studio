# Development Guide

Welcome to `do-knowledge-studio`! This guide covers everything you need to start contributing.

## Prerequisites

- **Node.js** v20+
- **pnpm** v10+
- **Browser** with OPFS support (Chrome 102+, Edge 102+)
- **Git** with conventional commit support

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd do-knowledge-studio
pnpm install

# Set up agent skills (optional, for AI agent workflows)
./scripts/setup-skills.sh

# Start development server
pnpm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
src/
├── app/           # App shell, routing, layout
├── components/    # Shared UI components (ErrorBoundary, Skeletons, etc.)
├── db/            # SQLite WASM database layer, migrations, repository
│   ├── repository/    # Modular repository (entities, claims, notes, links, etc.)
│   └── __tests__/     # Database tests
├── features/      # Self-contained feature islands
│   ├── ai/            # AI Harness (LLM chat, settings, rate limiter)
│   ├── editor/        # Entity editor with rich text (TipTap)
│   ├── export/        # Export panel (PDF, DOCX, PNG, etc.)
│   ├── graph/         # Force-directed knowledge graph (Graphology + Sigma.js)
│   ├── library/       # Entity browser/Library view
│   ├── mindmap/       # Mind map visualization
│   └── search/        # Progressive search (FTS5 + Orama)
├── hooks/         # Custom React hooks (useEscapeKey, useFocusTrap, etc.)
├── lib/           # Logic-only utilities (no UI dependencies)
│   ├── llm/           # LLM provider abstraction (OpenRouter, Kilo)
│   ├── search/        # Search engine (Orama, FTS5, NLP)
│   └── validation.ts  # Zod schemas for all data types
├── styles/        # CSS design tokens and global styles
cli/               # Node.js CLI entry points and commands
export/            # Static site export engine
plans/             # GOAP plans, ADRs, audits, benchmarks
scripts/           # Repository automation scripts
tests/             # Playwright end-to-end tests
docs/              # Project documentation
```

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start Vite dev server (hot reload) |
| `pnpm run build` | Production build |
| `pnpm run preview` | Preview production build locally |
| `pnpm run lint` | Run ESLint |
| `pnpm run typecheck` | Run TypeScript compiler checks |
| `pnpm run test` | Run Vitest unit tests |
| `pnpm run test:coverage` | Run tests with coverage report |
| `pnpm run test:e2e` | Run Playwright E2E tests |
| `pnpm run test:e2e:ci` | Run E2E tests (CI mode, chromium only) |
| `pnpm run cli -- <cmd>` | Run a CLI command |

---

## Quality Workflow

Before any non-trivial change:

```bash
pnpm run lint        # Check for style/lint issues
pnpm run typecheck   # Verify TypeScript types
pnpm run test        # Run unit tests
pnpm run build       # Verify production build
```

Before committing:

```bash
./scripts/quality_gate.sh         # Full quality gate
./scripts/minimal_quality_gate.sh # Fast quality gate (no build)
```

---

## Git Workflow

### Branch Naming

```bash
git checkout -b feat/<short-name>     # New feature
git checkout -b fix/<short-name>      # Bug fix
git checkout -b docs/<short-name>     # Documentation
git checkout -b refactor/<short-name> # Refactoring
```

### Commits

Use conventional commits:

```bash
git commit -m "feat(scope): short description"
git commit -m "fix(scope): short description"
git commit -m "docs(scope): short description"
git commit -m "refactor(scope): short description"
git commit -m "test(scope): short description"
```

### Hooks

Install git hooks for commit validation:

```bash
./scripts/install-hooks.sh
./scripts/validate-git-hooks.sh
```

---

## Architecture Overview

### Data Flow

1. **UI** (React) → **Repository** (API) → **Connection Pool** → **SQLite Worker** → **OPFS**
2. **Job Coordinator** → **Search Indexing** (FTS5 + Orama)
3. **CLI** → **Repository** → **SQLite** (via `better-sqlite3`)

### Key Design Decisions

- **Local-first**: No backend. SQLite WASM + OPFS for browser storage, `better-sqlite3` for CLI.
- **Worker-based**: SQLite runs in a Web Worker to avoid blocking the UI thread.
- **Dual search**: FTS5 for exact keyword matching, Orama for fuzzy/semantic search.
- **Zod validation**: All data validated at the repository boundary.
- **Strict TypeScript**: No `any` types. No magic numbers.

---

## Adding a New Feature

1. **Plan**: Create a plan in `plans/` following the GOAP format.
2. **Branch**: `git checkout -b feat/<name>`
3. **Implement**: Follow existing patterns. Max 500 LOC per file.
4. **Test**: Add unit tests in `__tests__/` next to the source file.
5. **Validate**: Run the quality gate.
6. **Commit**: Use conventional commits.
7. **Push and PR**: `git push origin feat/<name>` → open PR.

---

## Testing

### Unit Tests (Vitest)

- Located in `__tests__/` directories next to source files
- Use `vitest` with `jsdom` environment for React components
- Mock external dependencies (LLM providers, fetch, localStorage)

```bash
pnpm vitest run src/db/__tests__/repository.test.ts   # Run specific test
pnpm vitest run --watch                                # Watch mode
```

### E2E Tests (Playwright)

- Located in `tests/e2e/`
- Use chromium locally; CI runs mobile/tablet as well
- Test critical user journeys: entity CRUD, search, editor

```bash
pnpm run test:e2e                     # Run all E2E tests
npx playwright test tests/e2e/features.spec.ts  # Run specific test
```

### Coverage

```bash
pnpm run test:coverage
```

Coverage thresholds are currently low (~14% branches). Focus on covering critical paths: repository CRUD, search, export, and validation.

---

## Common Tasks

### Adding a New Entity Type

1. Update the type list in `src/features/editor/Editor.tsx`
2. Update any Zod schema constraints in `src/lib/validation.ts`
3. Add tests for the new type

### Adding a New CLI Command

1. Add the command in `cli/index.ts` following the existing pattern
2. Add a test in `cli/__tests__/commands.test.ts`
3. Document it in `docs/CLI.md`

### Adding a Database Migration

1. Create `public/db/migrations/004_<name>.sql` with UP and DOWN sections
2. Test with `pnpm run cli -- db:migrate` and `db:rollback`
3. Update `docs/DATABASE.md` if schema changes

### Adding a New LLM Provider

1. Create `src/lib/llm/<provider>.ts` implementing `LLMProvider` interface
2. Add it to the switch statements in `config.ts`
3. Add it to `PROVIDER_MODELS` in `src/lib/llm/index.ts`
4. Add tests in `src/lib/llm/__tests__/`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `pnpm run dev` fails | Run `pnpm install` to ensure dependencies are up to date |
| Tests fail with `crypto.subtle` error | Tests need Node.js 20+ with `--experimental-vm-modules` |
| OPFS not available | Use Chrome 102+ or Edge 102+. Firefox/Safari don't support OPFS yet. |
| Build fails on typecheck | Run `pnpm run typecheck` to see specific errors |
| E2E tests timeout | Ensure dev server is running: `pnpm run dev` then `pnpm run test:e2e` in another terminal |
| CLI can't find database | Use `--db-path` to specify the database file, or check `~/.local/share/do-knowledge-studio/` |

---

## See Also

- [Architecture](./ARCHITECTURE.md) — Module boundaries and data flow
- [CLI Reference](./CLI.md) — All CLI commands
- [Database Schema](./DATABASE.md) — Tables, relationships, and migrations
- [Setup](./SETUP.md) — Installation and deployment
- [Contributing](../CONTRIBUTING.md) — Contribution guidelines
