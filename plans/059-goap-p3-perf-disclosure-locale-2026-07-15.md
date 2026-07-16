# 059 — GOAP Swarm: P3 Perf, Disclosure & Locale (2026-07-15)

## Summary

Implement remaining P3 plan tasks from plans 053, 054, 057, 058, task-138,
task-141, and task-143. All changes are CI-safe, local-first, no new deps.

## Task Dependency Graph

```
Wave 0 (Foundation — no dependencies)
├── T0.1: Extract inline styles in graph-view.tsx (perf) ✅ ALREADY DONE
├── T0.2: Extract inline styles in mindmap-view.tsx (perf) ✅ ALREADY DONE
├── T0.3: Extract inline styles in editor-view.tsx (perf) ✅ ALREADY DONE
├── T0.4: Locale-safe date formatting in library-view.tsx (i18n) ✅ PR #445
└── T0.5: AI harness settings default collapsed (disclosure) ✅ PR #445

Wave 1 (Depends on Wave 0)
├── T1.1: Memoize graph-view visibleNodeIds/visibleEdges (perf) ✅ ALREADY DONE
├── T1.2: useCallback for library-view clearFilters (perf) ✅ PR #445
├── T1.3: Editor advanced section hint text (disclosure) ✅ ALREADY DONE (editor-toolbar.tsx:76)
└── T1.4: Graph snapshot list "Show More" pagination (perf) ⏳ FUTURE (low priority)

Wave 2 (Tests + verification — depends on Wave 1)
└── T2.1: Tests + quality gate (lint + typecheck + test + build) ✅ PR #445
```

## Constraints

- All CI must pass (lint, typecheck, test, build)
- No `any` types
- Max 500 LOC per file
- Named exports only
- Design tokens only (no hardcoded hex)
- All catch blocks handle errors meaningfully
- No new dependencies

## Verification

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```
