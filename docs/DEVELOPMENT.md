# Development Guide

## Architecture Overview

```
src/
├── app/           # App shell, routing, layout
├── components/    # Shared UI components
├── db/            # SQLite WASM database layer
├── features/      # Feature modules
│   ├── ai/        # AI harness, chat, entity extraction
│   ├── editor/    # Rich text editor (TipTap)
│   ├── export/    # Export panel, PDF/MD/JSON
│   ├── graph/     # Knowledge graph (Sigma.js)
│   ├── library/   # Entity browser
│   ├── mindmap/   # Mind map (Mind Elixir)
│   └── search/    # Search panel
├── hooks/         # Custom React hooks
├── lib/           # Shared utilities
│   ├── llm/       # LLM providers (OpenRouter, Kilo, Anthropic, Ollama)
│   ├── search/    # Search engine (FTS5 + Orama)
│   ├── ai/        # Entity extraction, graph linking
│   └── perf/      # Performance monitoring
├── store/         # Graph sync state
├── styles/        # CSS (tokens, components, layout)
└── types/         # Type declarations
```

## Key Abstractions

### Repository (`src/db/repository/`)

Data access layer for all SQLite operations. Split into focused modules:

- `entities.ts` — Entity CRUD
- `claims.ts` — Claim CRUD
- `notes.ts` — Note CRUD
- `links.ts` — Link CRUD
- `web-cache.ts` — URL content cache
- `graph-snapshots.ts` — Graph state snapshots

```typescript
import { repository } from '../db/repository';
const entities = await repository.getAllEntities();
```

### ConnectionPool (`src/db/connection-pool.ts`)

Manages SQLite WASM web workers for concurrent database access.

### JobCoordinator (`src/lib/jobs.ts`)

Async job processing with deduplication and retry logic.

### Orama Search (`src/lib/search/`)

In-browser vector search with progressive fallback.

## How to Add a Feature

1. Create `src/features/<name>/<Name>.tsx`
2. Add lazy import in `src/app/App.tsx`:
   ```typescript
   const MyFeature = lazy(() => import('./features/my-feature/MyFeature'));
   ```
3. Add view type to `View` union:
   ```typescript
   type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai' | 'library' | 'my-feature';
   ```
4. Add route in the view switch
5. Add nav button in `SidebarNav`
6. Add test in `src/features/<name>/__tests__/`

## Setup

```bash
pnpm install
./scripts/setup-skills.sh
pnpm run dev
```

## Development Commands

```bash
pnpm run dev          # Start dev server
pnpm run build        # Production build
pnpm run test         # Unit tests
pnpm run test:e2e     # E2E tests
pnpm run lint         # ESLint
pnpm run typecheck    # TypeScript check
pnpm run cli -- <cmd> # CLI commands
```

## Testing

- **Unit tests**: Vitest + jsdom — `pnpm run test`
- **E2E tests**: Playwright — `pnpm run test:e2e`
- **Coverage**: `pnpm run test:coverage`

Critical test coverage areas:
- Entity CRUD operations
- Search indexing and retrieval
- Export pipeline (MD, JSON, PDF, site)
- Graph rendering and interaction

## Common Debugging Patterns

### SQLite Worker Issues

Check `ConnectionPool` logs. Workers may timeout under heavy load:

```typescript
// Increase timeout if needed
const pool = new ConnectionPool({ poolSize: 4, timeoutMs: 30000 });
```

### Search Issues

Check Orama index state:

```typescript
import { oramaDb } from './search/orama-index';
console.log('Orama docs:', oramaDb?.size);
```

### Export Issues

Check `ExportPanel` and `export-core.ts`. Common issues:
- Missing entities (database not initialized)
- PDF rendering (dynamic import of `@react-pdf/renderer`)

### Graph Rendering

Check Sigma.js canvas. Common issues:
- Empty graph (no entities in database)
- Layout not applied (wait for graphology to initialize)

## Design Tokens

Use CSS variables from `src/styles/index.css`:

```css
var(--bg-base)           /* Background */
var(--text-primary)      /* Primary text */
var(--interactive-primary) /* Interactive elements */
var(--border-default)    /* Borders */
var(--space-4)           /* Spacing scale */
```

## Code Quality

- Max 500 LOC per file
- Strict TypeScript (no `any`)
- All exports must have JSDoc
- Run `pnpm run lint` before committing
