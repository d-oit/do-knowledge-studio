# Development Guide

This guide is for engineers working on `do-knowledge-studio` itself. It
explains the architecture, the abstractions you'll touch most often, and
the day-to-day commands and conventions for getting things done.

## Architecture Overview

```
src/
├── app/           # App shell, routing, layout (App.tsx, DbProvider)
├── components/    # Shared UI components (SidebarNav, Overlay, Skeletons, ui/)
├── db/            # SQLite WASM database layer
│   ├── client.ts          # better-sqlite3 / SQLite WASM shim
│   ├── connection-pool.ts # Worker pool for concurrent DB access
│   ├── db-worker.ts       # Web Worker entry point
│   ├── migrate.ts         # Migration runner
│   ├── repository/        # Typed CRUD over the schema
│   │   ├── entities.ts
│   │   ├── claims.ts
│   │   ├── notes.ts
│   │   ├── links.ts
│   │   ├── tags.ts
│   │   ├── entity-versions.ts
│   │   ├── graph-snapshots.ts
│   │   └── web-cache.ts
│   ├── DbProvider.tsx     # React context for the DB
│   └── useRepository.ts   # `useRepository()` hook
├── features/      # Feature modules (lazy-loaded)
│   ├── ai/        # AI Harness, chat, entity extraction, rate limiter
│   ├── editor/    # TipTap-based rich text editor
│   ├── export/    # Export panel, PDF, Markdown, JSON
│   ├── graph/     # Knowledge graph (Sigma.js + Graphology)
│   ├── library/   # Entity browser
│   ├── mindmap/   # Mind map (Mind Elixir)
│   ├── search/    # Search panel
│   └── import/    # Import panel
├── hooks/         # Reusable React hooks (useFocusTrap, useEscapeKey, …)
├── lib/           # Shared utilities
│   ├── llm/       # LLM providers (OpenRouter, Kilo, Anthropic, Ollama)
│   ├── search/    # Search engine (FTS5 hydrator + Orama)
│   ├── ai/        # Entity extraction, graph linking
│   ├── perf/      # Performance monitor
│   ├── jobs.ts    # JobCoordinator
│   ├── nlp.ts     # Text compression, stop-word removal
│   ├── resolver.ts# Web URL resolver
│   └── validation.ts # Zod schemas
├── store/         # Zustand stores (graph-sync, etc.)
├── styles/        # CSS tokens, components, layout
└── types/         # Ambient type declarations

cli/              # TypeScript CLI (Commander)
export/           # Static site export engine
scripts/          # Reusable repository automation
tests/            # Playwright e2e tests
public/db/migrations/  # Numbered SQL migration files
```

## Key Abstractions

### Repository (`src/db/repository/`)

Single source of truth for database access. Implemented as a small
class hierarchy:

- `RepositoryBase` (`base.ts`) — `exec`, `execRows`, `transaction`,
  metadata parsing helpers.
- `Repository` (`index.ts`) — composes the per-entity modules and
  implements the `IRepository` interface (`types.ts`).

Import the singleton:

```typescript
import { repository } from '../db/repository';
const entities = await repository.getAllEntities();
```

Or, in a React component:

```typescript
import { useRepository } from '../db/useRepository';
const repository = useRepository();
```

The repository auto-validates input through the Zod schemas in
`src/lib/validation.ts` and throws `AppError` on failure.

### ConnectionPool (`src/db/connection-pool.ts`)

Manages the SQLite WASM Web Worker. Allows concurrent database
operations by queueing requests. The pool is configured at boot
inside `DbProvider.tsx`; consumer code rarely needs to touch it
directly.

### JobCoordinator (`src/lib/jobs.ts`)

Serial job queue with deduplication, cancellation, and metrics.
Used for everything that should not block the UI thread:

- External URL fetches (`external-fetch`)
- Per-entity search reindexing (`reindex-document`)
- Full index rebuilds (`refresh-search-index`)

```typescript
import { jobCoordinator } from '../lib/jobs';

jobCoordinator.registerHandler('reindex-document', async (payload) => {
  const { entityId } = payload as { entityId: string };
  await upsertToSearchIndex(entityId);
});

jobCoordinator.enqueue('reindex-document', entityId);
```

Jobs with the same `(type, targetId)` pair are coalesced so rapid
edit bursts do not generate redundant work.

### Orama + FTS5 (`src/lib/search/`)

Two indexes, one pipeline:

- `orama-index.ts` — schema + in-memory index lifecycle.
- `progressive.ts` — stage-1 → stage-2 → stage-3 search pipeline.
- `fts5-hydrator.ts` — FTS5 index hydration.
- `external-fetch.ts` — URL resolution + entity hydration.

The public entry points are `searchKnowledge`, `semanticSearch`, and
`progressiveSearch`. See `docs/SEARCH.md` for details.

### DbProvider (`src/db/DbProvider.tsx`)

React context that:

1. Initializes the database (runs migrations, opens the connection).
2. Exposes `useDb()` and `useRepository()` to descendants.
3. Triggers Orama hydration on first mount.

`App.tsx` wraps the entire app in `DbProvider`, so most feature code
just uses the hooks.

## How to Add a Feature

1. **Create the feature module.** Put it in
   `src/features/<name>/<Name>.tsx` and an `__tests__` folder beside
   it. Follow the existing pattern (named export, default export,
   JSDoc on the public component).
2. **Add a lazy import in `src/app/App.tsx`:**
   ```typescript
   const MyFeature = lazy(() => import('./features/my-feature/MyFeature'));
   ```
3. **Add a preload function** so hover/focus can warm the bundle:
   ```typescript
   const preloadMyFeature = () => import('./features/my-feature/MyFeature');
   ```
   Wire it into `handlePreload()`.
4. **Extend the `View` union** with your new view id.
5. **Add a route branch** in `AppContent.render()` inside a
   `Suspense` + `ErrorBoundary`. Use a skeleton from
   `src/components/Skeletons.tsx` as the fallback.
6. **Add a `SidebarNav` entry** under the appropriate group
   (`Capture`, `Explore`, `Ask`, `Move`, `Lab`).
7. **Write tests.** Add a Vitest unit suite under
   `src/features/<name>/__tests__/` and, if it's a user-visible flow,
   an entry in `tests/` for Playwright.

## Setup

```bash
pnpm install
./scripts/setup-skills.sh    # Symlink agent skills
./scripts/validate-skills.sh

pnpm run dev                 # Vite dev server on http://localhost:5173
```

## Development Commands

```bash
pnpm run dev          # Vite dev server
pnpm run build        # tsc + vite build → dist/
pnpm run preview      # Serve the production build
pnpm run test         # Vitest unit tests
pnpm run test:watch   # Vitest watch mode
pnpm run test:coverage# Vitest with V8 coverage
pnpm run test:e2e     # Playwright e2e (assumes dev server is up)
pnpm run test:e2e:ci  # Playwright against the production build
pnpm run lint         # ESLint
pnpm run typecheck    # tsc --noEmit
pnpm run cli -- <cmd> # CLI commands
```

## Testing

- **Unit tests** — Vitest + jsdom. Lives next to the code in
  `__tests__/` folders. Run with `pnpm run test`.
- **E2E tests** — Playwright. Lives in `tests/`. Run with
  `pnpm run test:e2e`. CI uses `pnpm run test:e2e:ci` against a fresh
  production build.
- **Coverage** — `pnpm run test:coverage` writes `coverage/`. Target
  the changed code paths, not the global percentage.

Critical test coverage areas:

- Entity / claim / note / link / tag / version CRUD
- Search indexing and retrieval (`src/lib/search/__tests__/`)
- Export pipeline (Markdown, JSON, PDF, static site)
- Graph rendering and interaction
- Migration runner
- Job coordinator coalescing and metrics

## Common Debugging Patterns

### SQLite worker issues

Check the dev-tools console for messages from `DbProvider` and the
worker thread. Workers can time out under heavy load. To increase
the budget, edit `src/db/connection-pool.ts`.

### Search returns nothing

- Check that the Orama index is hydrated:
  ```typescript
  import { oramaDb } from './search/orama-index';
  console.log('Orama docs:', oramaDb?.size);
  ```
- Force a rebuild: open the AI Harness, open the settings, and
  trigger "Rebuild search index".
- Verify the FTS5 indexes are populated by running
  `pnpm run cli -- db:migrate` then reloading the app.

### Export issues

Check `src/lib/export-core.ts` and the format-specific exporter
(`pdf-exporter.tsx`, etc.). Common problems:

- Empty output — the database is not initialised yet.
- PDF rendering fails — the `@react-pdf/renderer` bundle is heavy
  and lazy-loaded; check the network panel for the chunk.

### Graph rendering is empty

- Open the Library view to confirm there are entities.
- Watch the console for Graphology initialization logs.
- Force a layout by switching layouts in `GraphControls`.

### Orama embeddings plugin fails to load

The plugin uses `@huggingface/transformers` to compute embeddings.
If the load fails, search silently falls back to BM25. Check the
network panel for a missing or failed WASM fetch.

## Design Tokens

Use CSS variables from `src/styles/index.css`:

```css
var(--bg-base)              /* Page background */
var(--bg-surface)           /* Card / panel surface */
var(--text-primary)         /* Primary text */
var(--text-secondary)       /* Secondary text */
var(--interactive-primary)  /* Primary action colour */
var(--border-default)       /* Default border */
var(--radius-base)          /* Default corner radius */
var(--space-4)              /* 4-step spacing scale */
var(--motion-fast)          /* Short motion duration */
var(--status-success)       /* Success accent */
var(--status-danger)        /* Danger accent */
```

Themes (`app`, `game`, `neural`, `technical`) are applied by setting
`data-theme` on `documentElement` — see `src/components/ThemeSwitcher.tsx`.

## Code Conventions

- **Strict TypeScript** — no `any`, no `// @ts-ignore` without
  justification.
- **Max 500 LOC per file** — refactor before extending oversized files.
- **Named + default exports** for every React component (consumers
  import the default; tests import the named).
- **JSDoc on every exported component, hook, schema, and class.**
- **No magic numbers** — extract to a named constant.
- **No project-level config in source files** — pull from
  `src/lib/constants.ts` or env.
- **No new dependencies without discussion** — the `pnpm-lock.yaml`
  is the source of truth.

## Code Quality Workflow

Before opening a PR:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

For UI, editor, graph, mind map, database, search, export, or
critical workflow changes, also run:

```bash
pnpm run test:e2e
```

The full quality gate lives at `./scripts/quality_gate.sh`. A faster
loop is `./scripts/minimal_quality_gate.sh`.

## Contribution Guidelines

- Branch from `main` using `feat/<short-name>` or `fix/<short-name>`.
- Keep commits atomic and use conventional-commits prefixes
  (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).
- Do not commit secrets, generated artifacts, or scratch files to the
  repository root.
- Update the matching plan in `plans/` if your change crosses
  architectural boundaries.

See `CONTRIBUTING.md` for the full contributor guide.
