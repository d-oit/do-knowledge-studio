# ADR 043: Canvas Reference Integrity

**Date**: 2026-10-13
**Status**: Implemented
**Related**: Plan 165, Plan 162, ADR 010, ADR 037

## Context

Graph, mind-map, and cross-entity link payloads are optional corpus data. Before
this decision, deleting an entity removed its entity record and claims but left
canvas nodes, edges, and links naming the deleted id. Imports and remote merges
could carry the same dangling references, and JSON export re-emitted them. Undo
snapshots did not carry the canvas, so undoing a delete could not restore the
whole visible corpus.

## Decision

1. Graph and mind-map edges and top-level links MUST resolve both endpoints to
   entity ids in the same corpus. Delete, import, hydration, recovery restore,
   remote reconciliation, and JSON export prune references that no longer resolve.
2. Graph and mind-map nodes are self-contained data (`id`, `label`, `type`, and
   coordinates where present), not references to entity records. A node whose
   id is not a live entity remains unless `removeCanvasRefs` removes it because
   its own id was deleted.
3. Undo history carries the optional canvas payload. One undo after entity
   deletion restores the deleted entity and the canvas objects removed with it;
   redo reapplies the deletion.
4. History reconciliation prunes canvas edges and links against that history
   step's own entities. Older snapshots with no canvas remain valid and keep
   that field absent.
5. A remote corpus change reconciles the effective local/remote canvas and
   rebases the undo baseline when either corpus or canvas changes. Unchanged
   canvas field references are preserved to avoid spurious change detection.

This closes Plan 162's dangling-reference gap through integrity, not by treating
canvas data as independent of the corpus.

## Consequences

- JSON import and OKF import share the store's import boundary and cannot seed
  dangling edges or links.
- JSON export is safe for legacy or otherwise inconsistent in-memory canvas
  data; nodes remain untouched because they are self-contained.
- Recovery snapshots preserve canvas in every undo step, and recovery restore
  prunes current canvas. Zod validation remains backward-compatible with snapshots
  written before this decision.
- Cross-tab updates retain reference identity for unchanged canvas fields.
