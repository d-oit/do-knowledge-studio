# ADR 051 — Graph queries and saved views

- Status: Accepted
- Date: 2026-11-05
- Issue: #1058
- Related: ADR 028 (validated persistence), ADR 037 (URL state), ADR 050 (MCP bridge)

## Context

The graph view needed three capabilities: ask structural questions (shortest
path, filtered views), jump back to a curated canvas setup, and expose the same
questions to the AI tools and the offline MCP bridge. Two constraints shaped the
decision: the app is local-first with no required backend, and the canonical
corpus lives in IndexedDB through the Zustand persist envelope while
localStorage carries only metadata, recovery snapshots, and quarantine copies.

## Decision

1. **Queries are pure functions** in `src/lib/studio/graph-query.ts` over plain
   `Entity[]` / `Claim[]`. No React, no storage, no layout dependency.
2. **Paths are BFS over undirected links**, deterministic by display name, with
   explicit `unknown-entity` and `no-path` results rather than empty arrays.
3. **Saved views are corpus-adjacent user data in the store envelope.** A view
   is a Zod-validated record (`id`, `name`, `filter`, `layout`, `focusMode`,
   `viewport`, `createdAt`), persisted through the existing `partialize` and
   re-validated by `PersistedEnvelopeSchema` on every load, defaulting to `[]`
   so pre-existing envelopes still hydrate. The list is capped at 50.
4. **Views travel in `data/canvas.json`** inside the backup archive, validated
   by `SavedGraphViewsSchema` at the archive boundary and composed on restore
   with the same replace/merge semantics as the other canvas fields.
5. **The MCP package mirrors the algorithm rather than importing app code.**
   `packages/dks-mcp` is a separate Node package over an exported bundle; the
   app is a private Next.js package. The package implements BFS over `# Related`
   with the same undirected, deterministic rules.

## Consequences

- The canvas, the AI registry, and the MCP bridge answer path questions the same
  way, and the ranking/filtering rules have one owner.
- Saved views inherit the whole persistence pipeline for free: validation,
  quarantine on corrupt payloads, cross-tab broadcast, and backup round-trip.
- An invalid view in a stored envelope cannot crash the canvas: the schema
  rejects the payload at the hydration boundary (existing failure policy:
  refuse, preserve bytes, report).
- Two BFS implementations exist by necessity (app and package). They are kept
  deliberately small, and both are covered by their own tests; a shared
  workspace package would be the refactor if a third consumer appears.

## Alternatives considered

- **localStorage for saved views**: rejected — it would grow the localStorage
  envelope into a second corpus, against the persistence rule in AGENTS.md.
- **Storing views as entities or claims**: rejected — they are canvas UI state,
  not knowledge, and would pollute search, graph rendering, and export counts.
- **Weighted Dijkstra by relation type**: deferred. There is no weight model in
  the corpus yet; inventing one would produce numbers the UI cannot justify.
