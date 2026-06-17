# ADR 014: Test Architecture — Pure Data Transform Extraction

**Status**: 📝 Proposed
**Date**: 2026-06-16
**Source**: Plan 35 (Test Coverage Expansion) — gap closure via Plan 041
**Deciders**: Engineering

## Context

Plan 35 called for unit tests on `MindMapView.tsx` (415 LOC) and `GraphView.tsx` (793 → 456 LOC after Plan 34.2 split). Both components contain **data transformation logic** mixed with **React rendering**:

- `MindMapView.tsx`: `buildTree()` constructs a hierarchical tree from a flat `(entities, links)` pair
- `GraphView.tsx`: data shaping for `graphology` (nodes, edges, attributes) before render

Pure-function testing of this logic is currently impossible without mounting the full React component, which:
- Requires jsdom + Sigma.js mocking
- Couples test failures to render state, not data correctness
- Slows CI (full mount per test)
- Hides edge cases (empty input, circular refs, depth limits)

This ADR documents the pattern used to close that gap: **extract pure data transforms into React-free modules** that can be tested in isolation.

## Decision

For each view-level component that mixes data shaping with rendering, follow this two-step pattern:

### Step 1: Extract pure functions to `src/lib/`

```typescript
// src/lib/mindmap-tree.ts
import type { Entity, Link } from './validation';

export interface MindMapNode {
  id: string;
  label: string;
  children: MindMapNode[];
  depth: number;
}

export function buildTree(
  entities: Entity[],
  links: Link[],
  rootId?: string,
  maxDepth = 10
): MindMapNode[] {
  // ... pure logic, no React imports
}
```

```typescript
// src/lib/graph-data.ts
import type { Entity, Link } from './validation';
import Graph from 'graphology';

export function buildGraphologyInstance(
  entities: Entity[],
  links: Link[]
): Graph {
  const graph = new Graph({ type: 'directed', multi: true });
  for (const entity of entities) {
    graph.addNode(entity.id, { label: entity.name, type: entity.type });
  }
  for (const link of links) {
    if (graph.hasNode(link.sourceId) && graph.hasNode(link.targetId)) {
      graph.addEdge(link.sourceId, link.targetId, { id: link.id, label: link.relationType });
    }
  }
  return graph;
}
```

### Step 2: Have the component delegate to the pure function

```typescript
// src/features/mindmap/MindMapView.tsx
import { buildTree } from '../../lib/mindmap-tree';

const tree = useMemo(
  () => buildTree(entities, links, selectedEntityId),
  [entities, links, selectedEntityId]
);
```

```typescript
// src/features/graph/GraphView.tsx
import { buildGraphologyInstance } from '../../lib/graph-data';

const graph = useMemo(
  () => buildGraphologyInstance(entities, links),
  [entities, links]
);
```

### Step 3: Unit-test the pure function with edge cases

```typescript
// src/lib/__tests__/mindmap-tree.test.ts
import { describe, it, expect } from 'vitest';
import { buildTree } from '../mindmap-tree';

describe('buildTree', () => {
  it('returns empty array for empty entities', () => {
    expect(buildTree([], [])).toEqual([]);
  });
  it('creates single root for single entity', () => {
    expect(buildTree([makeEntity({ id: '1', name: 'Root' })], [])).toEqual([
      { id: '1', label: 'Root', children: [], depth: 0 },
    ]);
  });
  it('respects maxDepth', () => { ... });
  it('filters to outgoing links only', () => { ... });
  it('handles null entities', () => { ... });
  it('protects against circular references', () => { ... });
  it('attaches correct children to correct parents', () => { ... });
  it('preserves entity order in children', () => { ... });
});
```

## Conventions

| Convention | Rationale |
|------------|-----------|
| **Pure function, no React imports** | Enables jsdom-free testing; faster CI |
| **Pure function takes plain data, returns plain data** | No class instances, no `useState`, no hooks |
| **Function in `src/lib/`, not `src/features/`** | Lib is the public surface; features are composition |
| **Test file at `src/lib/__tests__/<name>.test.ts`** | Mirrors the source path per the project taste (`taste.md`) |
| **Component imports + delegates** | View layer becomes thin composition; logic is testable |
| **Edge cases prioritized**: empty, null, circular, max-depth, filtering | The 80% of bugs come from these cases |

## Why not test through the component?

| Approach | Mount cost | Data correctness | Render coupling | Speed |
|----------|-----------|------------------|-----------------|-------|
| **Test through component** (status quo) | High (Sigma.js + jsdom) | Hidden behind render | Yes (test fails on style/dom issues too) | Slow |
| **Extract + test pure** (chosen) | Zero (just `vitest`) | Visible directly | No | Fast |
| **E2E test only** | Highest | Hidden behind full app | Yes (network, async) | Slowest |

## Alternatives

### A. Test through the component only
- **Pros**: No refactor; tests the actual render path.
- **Cons**: Slow, fragile, doesn't isolate data logic, requires heavy mocking.

### B. E2E test only (no unit tests for data)
- **Pros**: Tests real user behavior.
- **Cons**: Doesn't catch data-edge cases; slow feedback loop.

### C. Extract + test pure (chosen)
- **Pros**: Fast, isolated, thorough, reusable across views.
- **Cons**: One-time refactor cost; component becomes slightly more abstract.

### D. Snapshot-test the data
- **Pros**: Catches unintended changes.
- **Cons**: Doesn't cover edge cases; tests become noise.

## Consequences

### Positive
- Pure functions are reusable (e.g., `buildTree` can power the graph view too)
- Test runs in < 100ms per case (vs > 1s for component mount)
- Edge cases (empty, circular, null) get explicit coverage
- New contributors can read the data logic without understanding React

### Negative
- One-time refactor cost (~1-2h per view)
- The component file gets slightly smaller (good) but the lib directory grows

### Neutral
- The component still needs integration tests (E2E + maybe one smoke test)
- `graphology` is a runtime dep of `src/lib/graph-data.ts` — but `graphology` is already a project dep

## Files Affected (initial wave)

- `src/lib/mindmap-tree.ts` (new)
- `src/lib/__tests__/mindmap-tree.test.ts` (new)
- `src/lib/graph-data.ts` (new)
- `src/lib/__tests__/graph-data.test.ts` (new)
- `src/features/mindmap/MindMapView.tsx` (delegate to `mindmap-tree`)
- `src/features/graph/GraphView.tsx` (delegate to `graph-data`)

## Verification

```bash
# 1. Pure function exists and is React-free
grep -L "react" src/lib/mindmap-tree.ts src/lib/graph-data.ts
# Both should output their paths (no react imports)

# 2. Test files exist with expected case count
grep -c "it(" src/lib/__tests__/mindmap-tree.test.ts src/lib/__tests__/graph-data.test.ts
# mindmap-tree: ≥ 8
# graph-data: ≥ 6

# 3. Pure tests pass fast
pnpm run test src/lib/__tests__/mindmap-tree.test.ts
# < 200ms

# 4. Component still works
pnpm run test:e2e
# All green
```

## References

- Plan 35.1, 35.3 (Mind map + graph tests) — `plans/35-test-coverage-expansion.md`
- Plan 041 (this work) — `plans/041-goap-remaining-gaps-tests-docs-logging-2026-06-16.md`
- Test pattern convention — `.commandcode/taste/taste.md` (test files mirror source path under `__tests__/`)
- Existing example — `src/lib/graph-layout.ts` (already a pure module extracted from `GraphView.tsx` per Plan 34.2)
