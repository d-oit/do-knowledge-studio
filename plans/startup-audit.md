# Startup Task Inventory

Classification of all startup tasks in the critical boot path.

## Critical Before Paint

These must complete before the user sees anything meaningful:

| Task | Location | Why Critical |
|------|----------|-------------|
| ReactDOM.createRoot | `src/main.tsx:5` | Must render to show anything |
| DbProvider mount | `src/db/DbProvider.tsx` | Gate for all data operations |
| SQLite WASM load + OPFS init | `src/db/db-worker.ts` | Required before any DB query |
| Schema execution | `src/db/db-worker.ts:59` | Tables must exist before reads |
| Loading screen ("Booting...") | `src/app/App.tsx:123` | User feedback during init |

## Required Before Interaction

These must complete before the editor is usable:

| Task | Location | Dependencies |
|------|----------|-------------|
| refreshData (entities + links) | `src/app/App.tsx:77` | dbReady |
| Default editor render | `src/app/App.tsx:125-131` | dbReady |
| Header + SidebarNav render | `src/app/App.tsx:109-120` | First render |

## Safe After Idle / Deferred

These can be delayed without affecting first paint or first interaction:

| Task | Location | Current Strategy | Improvements |
|------|----------|-----------------|-------------|
| Orama search init | `src/lib/search.ts:344` | Already `requestIdleCallback` | ✅ Already deferred |
| Semantic embeddings load | `src/lib/search.ts:46-63` | Lazy on first semantic click | ✅ Already deferred |
| refreshData on view change | `src/app/App.tsx:82-86` | Runs immediately | Could debounce |
| Command palette eager import | `src/app/App.tsx:14` | Eager import | ❌ Should be `React.lazy` |
| Graph/GraphControls/MindMap exports | `src/app/App.tsx:26-32` | Already `React.lazy` | ✅ Already lazy |
| AI Harness export | `src/app/App.tsx:33` | Already `React.lazy` | ✅ Already lazy |
| ThemeSwitcher render | `src/app/App.tsx:117-119` | Rendered immediately | Could defer |

## Performance Budget

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Time to first paint | < 1s | ~200ms (no WASM) | ✅ |
| Time to interactive (editor) | < 2s | ~500ms (cold) | ✅ |
| Time to search ready | < 5s | ~2s (with 1k entities) | ✅ |
| Initial JS bundle | < 150KB | ~924KB (10 chunks) | ⚠️ Exceeds target |
| Total JS bundle | — | ~2.82MB (all chunks) | ℹ️ Includes lazy-loaded chunks |

## Changes Made

1. **Lazy loaded CommandPalette**: Changed from eager import to `React.lazy` + `Suspense`
2. **Deferred non-critical refreshData**: Only refresh data on mount; view-change refresh is debounced
3. **Created preload-on-intent**: Heavy chunks (graph, mindmap, etc.) preloaded on nav hover/focus
