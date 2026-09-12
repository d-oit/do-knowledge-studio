# Plan 135 — N7: Extensible entity-type registry (issue #757)

**Date**: 2026-09-08
**Type**: Implementation note (N7 workstream of the open-issues swarm)

## Goal

Let plugins/custom UI register new entity types at runtime without touching the
persisted-data model. Registered types appear everywhere type metadata is
rendered: type selector, library grid/list, entity icons, graph nodes, graph
legend, and mind map theming. Entities persisted with custom type strings pass
hydration validation; garbage strings are still rejected.

## Design

- `src/lib/studio/entity-types.ts` — client-singleton registry
  - `EntityTypeDef` / `EntityTypeMeta` interfaces (`id`, `label`, `color`,
    `bg`, `text`, `dot`, optional `icon: LucideIcon`).
  - `EntityTypeDefSchema` (Zod) mirrors the persisted-id constraints
    (non-blank, ≤ 64 chars) so any id that registers also passes hydration.
  - `registerEntityType(def)` — idempotent by id (re-register replaces);
    throws on schema-invalid defs; refuses to override built-in ids
    (`console.error` + no-op).
  - `getEntityTypeDefs()` — built-ins (canonical order) then customs
    (insertion order).
  - `getEntityTypeMeta(type)` — never throws: custom registry → built-in
    `ENTITY_TYPE_META` → neutral zinc default (label = raw type string).
  - `resetCustomEntityTypes()` — test helper.
- `src/lib/studio/types.ts` seam
  - `EntityType` stays the exact built-in union (persisted compatibility,
    exhaustive switches).
  - `AnyEntityType = EntityType | (string & {})`; `Entity.type` and
    `GraphNode.type` widened to it. `ENTITY_TYPE_META` stays typed on the
    built-in union.
- `src/lib/studio/schema.ts`
  - `CustomEntityTypeSchema` (non-blank, ≤ 64 chars) + `AnyEntityTypeSchema`
    (union with the builtin enum). `EntitySchema.type`, `GraphNodeSchema.type`,
    `MindMapNodeSchema.type`, and the persisted `typeFilter` use it — custom
    types survive hydration; `''` / whitespace / >64 chars rejected.
- Consumers route through `getEntityTypeMeta`/`getEntityTypeDefs`:
  `type-selector.tsx` (dynamic list), `entity-type-icon.tsx` (builtin switch +
  registry/neutral fallback), `editor-helpers.tsx` seams, `library-entities.tsx`
  grid/table meta, `graph-view.tsx` node theming + legend, `mindmap-view.tsx`
  tree theming.

## How to register a custom type (plugin API)

```ts
import { registerEntityType } from '@/lib/studio/entity-types'

registerEntityType({
  id: 'roadmap',           // non-blank, ≤ 64 chars; persisted in Entity.type
  label: 'Roadmap',
  color: 'violet',
  bg: 'bg-violet-100 dark:bg-violet-950/40',
  text: 'text-violet-700 dark:text-violet-300',
  dot: 'bg-violet-500',
  icon: Map,               // optional; defaults to a neutral icon
})
```

Registered types immediately appear in the type selector, library meta, graph
legend/theming, and mind map colors. There is intentionally **no registration
UI** in this pass — the registry is the plugin API (see follow-ups).

## Persistence / seeds

No new seeded entities with custom types were added: seeds only load on first
run and the built-in four cover the demo corpus (migrations.ts has no
custom-type path). Custom types only ever enter user data via the registry +
editor selection, so no migration is required.

## Cross-workstream notes (Main)

- TypeFilter widening (store.ts + hydration.ts `PersistedSlice`) —
  `EntityType | 'all'` → `AnyEntityType | 'all'` (proposed via hub).
- Store `useStats` `byType` accumulator → `Record<string, number>`.
- `editor-view.tsx` `useState<AnyEntityType>` for the editor draft type.
- Meta lookups in `home-view.tsx`, `mobile-drawer.tsx`, `right-panel.tsx`,
  `command-palette.tsx` → `getEntityTypeMeta(...)`.

## Tests

- `entity-types.test.ts` — register/idempotency/order/reset/fallback/validation.
- `schema.test.ts` — `CustomEntityTypeSchema`/`AnyEntityTypeSchema` acceptance +
  garbage rejection; custom types flow through `EntitySchema`,
  `GraphNodeSchema`, `MindMapNodeSchema`, `validatePersistedState`.
- `type-selector.test.tsx` — dynamic list incl. a registered custom type.
- `entity-type-icon.test.tsx` — builtin mapping, registered icon, neutral fallback.
- e2e `entity-types.spec.ts` — library exposes builtin filters and type labels.

## Follow-ups

- Library filter chips (`library-view.tsx` `FILTERS`) should enumerate
  `getEntityTypeDefs()` so customs are filterable (owned by the library-view
  workstream; needs the Main-applied `typeFilter` widening first).
- Home-view stats bar and command palette hints render customs via the neutral
  fallback label until Main applies the `getEntityTypeMeta` swaps.
- A future settings panel could expose registration UI for end users
  (out of scope for #757 — registry is the plugin API).