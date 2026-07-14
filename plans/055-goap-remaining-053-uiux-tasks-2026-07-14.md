# 055 — GOAP Swarm: Remaining Plan 053 + UI/UX Audit Tasks (2026-07-14)

## Summary

Implement remaining tasks from plans 053 and 054 plus P1/P2 items from the
ui-ux-audit-2026-07-11. CI-safe, local-first, no breaking changes.

## Task Dependency Graph

```
Wave 0 (Foundation — no dependencies)
├── T0.1: useReducedMotion hook (src/lib/studio/use-reduced-motion.ts)
├── T0.2: Graph entity index (Map<id, Entity>) for O(1) lookups
└── T0.3: EmptyState + Skeleton shared primitives (src/components/studio/ui/)

Wave 1 (Component fixes — depends on Wave 0)
├── T1.1: Gate Framer Motion with useReducedMotion across all 7 component files
├── T1.2: Keyboard-operable library rows (Enter/Space on <tr>)
├── T1.3: Keyboard-operable graph nodes (tabindex, Enter to select)
├── T1.4: Remove inert demo controls (toast.info stubs in mindmap, graph)
└── T1.5: Touch target audit — ensure 44×44px minimum on interactive elements

Wave 2 (Performance + tests — depends on Wave 1)
├── T2.1: Store subscription narrowing with shallow selectors
├── T2.2: Tests for useReducedMotion, EmptyState, graph index
└── T2.3: Replace inline empty states with EmptyState primitive

Quality Gate: lint + typecheck + test + build
```

## Agents

| Agent | Tasks | Strategy |
|-------|-------|----------|
| motion-agent | T0.1, T1.1 | Sequential |
| a11y-agent | T1.2, T1.3, T1.5 | Sequential |
| cleanup-agent | T1.4 | Single |
| store-agent | T0.2, T2.1 | Sequential |
| ui-agent | T0.3, T2.3 | Sequential |
| test-agent | T2.2 | Single |

## Constraints

- All CI must pass (lint, typecheck, test, build)
- No `any` types
- Max 500 LOC per file
- Named exports only
- Design tokens only (no hardcoded hex)
- All catch blocks handle errors meaningfully
