# Plan 134 — Improvement & New-Feature Analysis (2026-09-06)

**Type**: Codebase analysis / improvement audit (not an implementation plan)
**Scope**: `src/` quality, data-integrity correctness, performance, and high-value
new feature candidates.
**Method**: Static review of the working tree at `8542a41`. This is a distinct
slice from Plans 131/133 — it does **not** repeat the LANEs already committed
there and focuses on defects that remain verifiable **today**.

---

## 1. Health snapshot

- **Stack**: Next.js 16 (App Router), React 19, Tailwind 4, Zustand + localStorage,
  Yjs + WebRTC, BM25 in-browser search (Web Worker), Vitest + Playwright.
- **Latest commit**: `8542a41 perf(okf): optimize OKF bundle related link
  generation with O(1) entity lookup (#742)`.
- **Maturity**: Very high — extensive quality-gate tooling (`scripts/quality_gate.sh`,
  `minimal_quality_gate.sh`, `verify-deps.sh`, link/CI validators), 130+ plan
  artifacts, ADRs, and strong test coverage. Most Plan 131 G1 findings (hydration
  contract) and Plan 133 items (search worker, IndexedDB backup, context pruning)
  are already landed — e.g. `src/lib/studio/hydration.ts` now validates **every**
  hydration path and rejects invalid envelopes, and the inbound sync bridge
  (`startBidirectionalSync` → `subscribeToYjs`) is wired.
- **Sizing**: 25k LOC of `src`; the only files over the 500-LOC ceiling are
  `src/components/ui/sidebar.tsx` (788, documented shadcn exception) and
  `src/lib/studio/store.ts` (475, near-limit, see §3.B).

---

## 2. Summary table

| ID | Severity | Area | Status today |
|----|----------|------|--------------|
| F1 | **High** | Search is ASCII-only → non-English content unsearchable | **Still present** |
| F2 | **High** | Sync claim merge drops provenance fields | **Still present** |
| F3 | **High** | Tombstone guard inverted for absent local records | **Still present** |
| F4 | **Medium** | No cross-tab store coordination | **Still present** |
| F5 | **Medium** | Chat search runs synchronous BM25 on main thread | **Still present** |
| F6 | **Medium** | Library grid & AI/chat use different relevance semantics | **Still present** |
| F7 | **Low** | AI settings live on a third, unvalidated persistence layer | **Still present** |
| N1 | New | Semantic / multilingual search (embeddings) | Not present |
| N2 | New | Timeline view (temporal axis) | Not present |
| N3 | New | `@mention` entity linking in editor | Not present |
| N4 | New | Rule-based claim extraction | Not present |
| N5 | New | i18n / localization string layer | Not present |
| N6 | New | Fully-offline local LLM (WebLLM / Transformers.js) | Not present |
| N7 | New | Extensible entity-type plugin system | Not present |

---

## 3. Defects & improvements still verifiable today

### F1 — Search tokenizer is ASCII-only (blocks non-Latin + accented text)

`src/lib/search/retrieval.ts:38-44`

```ts
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')   // <-- strips CJK, Cyrillic, accented glyphs
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}
```

Every non-`[a-z0-9]` character is replaced with a space, so a query for
"経営戦略", "café", or "научный" yields **zero tokens** and the search returns
nothing. This is a cross-cutting defect: it degrades the Library search line,
`Chat`, the AI harness local-context retrieval (`lib/ai/context.ts`) and the
`search_library` tool (`lib/ai/tools.ts`). It directly contradicts the project
rule *"Prefer `Intl.Segmenter` over manual string splitting for i18n-safe text
processing."*

**Fix direction**: tokenize with `Intl.Segmenter` word segmentation, keep
code-point-based tokens for scripts that use word segmentation poorly, and
drop the `.length > 2` filter for CJK (2 characters are meaningful). Add
regression tests with Japanese, Chinese, Cyrillic, and accented corpora
(Plan 131's D3.1 table still lists this as an unpinned regression).

---

### F2 — Sync claim merge silently destroys provenance

`src/lib/sync/merge.ts:244-258` (`mergeSingleClaim`) reconstructs a claim from
only `id`, `entityId`, `statement`, `evidence`, `confidence`, `verification`,
`source` — dropping `createdAt`, `updatedAt`, `version`, and `editHistory`.
`src/lib/sync/types.ts:60-86` (`claimToYMap` / `ymapToClaim`) also omit
`version` and `editHistory`. Net effect: one sync round-trip resets LWW
timestamps and claim versioning, and the edit-history trail is lost. This was
flagged as **D1.8** in Plan 131 and is still unaddressed.

**Fix direction**: carry the full claim shape through the Yjs round-trip and
`mergeSingleClaim`, preserving `version`/`editHistory`; add a regression test
that syncs a claim and asserts its metadata survives.

---

### F3 — Tombstone guard is inverted for absent local records

`src/lib/sync/bridge.ts:186`, `:194`

```ts
if (!local || !isTombstoned(remote.id)) {
```

When there is **no local record** (`!local` is `true`), the guard short-circuits
and a *tombstoned remote* record is merged in (resurrecting a deleted entity).
This currently only survives because callers pre-filter `validEntities` /
`validClaims`, so the *exported contract* is wrong and its branch test cements
the bug (Plan 131 **D1.11**).

**Fix direction**: treat "absent local" as *not* a free pass — a tombstoned
remote must be skipped even when local is missing:
`if (local && !isTombstoned(remote.id)) { ... } else if (!local && !isTombstoned(remote.id)) { ... }`.
Update the branch test accordingly.

---

### F4 — No cross-tab store coordination (last-writer-wins over the blob)

There is **no** `BroadcastChannel`/`storage` listener on the main Zustand store.
`BroadcastChannel` is only used for peer discovery
(`src/lib/sync/discovery.ts`). Two tabs open on the same corpus use
last-writer-wins over the entire envelope on every `setState`, so edits in one
tab silently clobber the other (Plan 131 **D1.10**).

**Fix direction**: subscribe to `window 'storage'` / a `BroadcastChannel`,
re-validate the incoming envelope with the existing `validatePersistedState`,
and apply it with the already-built `mergeEntities`/`mergeClaims` for a
field-level merge instead of a whole-blob swap. Keep it passive (tabs shouldn't
write-lock), and guard against feedback loops with an origin tag.

---

### F5 — Chat & AI retrieval run synchronous BM25 on the main thread

The Web Worker search client exists and is tested
(`src/lib/search/search-worker-client.ts`, `search-worker.ts`) but **is never
invoked in the product paths**. The hot paths still call the synchronous
`search()`:

- `src/lib/studio/store.ts:293` (`sendMessage`)
- `src/components/studio/right-panel.tsx:45`
- `src/components/studio/mobile-drawer.tsx:241`
- `src/lib/ai/context.ts:28`, `src/lib/ai/tools.ts:97`

For a 20k-entry corpus this blocks the UI thread during typing/chat.

**Fix direction**: route `sendMessage` and the chat/AI context builders through
`searchAsync` (the worker client falls back gracefully to synchronous search in
SSR/Vitest), and add `AbortController` to the in-flight send (Plan 131 **D1.22**
— still open).

---

### F6 — Library grid and Chat/AI use two different relevance models

`useFilteredEntities` in `src/lib/studio/store.ts` filters via substring
`includes()` on name/description/tags, while Chat/AI use BM25
(`search()`). The same query therefore returns different results in the Library
grid vs. the right-panel ranked mode — a confusing inconsistency for users.

**Fix direction**: unify on BM25 for the Library grid (it's already the
recommended retrieval engine and now worker-backed), or at minimum document the
two models and keep the ranked panel consistent. This is also the natural seam
for the semantic-search upgrade (N1).

---

### F7 — AI settings live on a third, unvalidated persistence layer

`src/lib/studio/ai-settings.ts` persists to IndexedDB + a sessionStorage AES key,
with no Zod boundary on read and a migration that marks completion before
verifying the subsequent read (Plan 131 **D1.13**). This is a correctness /
threat-model gap.

**Fix direction**: validate IDB reads with a Zod schema, only mark migration
done after a successful read-back, and document the session-storage AES threat
model (or move the key into the existing IndexedDB tiered-backup module).

---

### Store near the 500-LOC ceiling

`src/lib/studio/store.ts` is **475 LOC** and spans six concerns (navigition,
entities, undo history, claims, library controls, chat, import/reset, graph
metadata). It is one feature away from violating the hard ceiling in AGENTS.md.

**Fix direction**: slice before the next store feature — extract a
`chat-slice`, `history-slice`, and `entities-slice` via Zustand's slice
composition, and collapse the near-duplicate `commitEntity`/`saveEntity`
(currently differing only by navigation side effects).

---

## 4. New-feature candidates (high value, aligned with the product vision)

### N1 — Semantic / multilingual search
**Why**: F1 shows the current engine cannot even index non-Latin text; BM25 is
keyword-only. Adding in-browser embeddings (`@huggingface/transformers` /
`transformers.js` + a WASM vector store) gives semantic recall *and* fixes the
multilingual case in one move. Keep the BM25 worker as a fast lexical fallback.
**Effort**: High (model + indexing pipeline + vector store). **Impact**: Very high.
**Dependency**: F1 (fix tokenization first so lexical and semantic paths agree).

### N2 — Timeline view
**Why**: Entities/claims already carry `createdAt`/`updatedAt`; a temporal axis
visualization (grouped by day/month, with claim markers) is a clean, cheap win
that differentiates the product and reuses existing data with no new storage.
**Effort**: Medium. **Impact**: Medium. **Dependency**: none.

### N3 — `@mention` entity linking in the editor
**Why**: The editor is markdown + `react-markdown`; the knowledge graph lives on
`links[]`. An autocomplete `@`-mention that resolves to an existing entity and
writes a `links[]` entry (with an optional backlink) is the highest-value editor
feature and directly grows the graph with minimal friction.
**Effort**: High (mentions extension + autocomplete + link writer). **Impact**: High.

### N4 — Rule-based claim extraction
**Why**: A lightweight parser for `Assertion: <stmt> (Source: <src>)` patterns
converts typed prose into structured, verifiable claims — a staple of the
"claims-first" vision (`OPTIMIZATIONS.md §2`). No LLM needed at runtime.
**Effort**: Medium. **Impact**: Medium-high. **Dependency**: none.

### N5 — i18n-ready string layer
**Why**: AGENTS.md mandates *"Never hardcode user-facing strings — extract to
constants or i18n-ready string maps for future localization."* Today there is no
i18n infrastructure and views ship 50+ hardcoded strings each (e.g. `home-view.tsx`).
Extract to a typed `messages/` map now (even without a translation engine) so a
future `next-intl`/`react-i18next` layer is additive.
**Effort**: Low-medium (mechanical, high-touch). **Impact**: Medium (risk of
localization retrofits later).

### N6 — Fully-offline local LLM (WebLLM / Transformers.js)
**Why**: The AI harness currently requires OpenRouter or a local Ollama. An
in-browser decoder model closes the "zero network / zero backend" promise for
summarization and claim extraction while staying fully local-first.
**Effort**: High (model download, chat perf, mobile memory). **Impact**: Very high.
**Dependency**: none (orthogonal to provider adapters).

### N7 — Extensible entity-type plugin system
**Why**: `EntityType` is a closed union (`'note' | 'concept' | 'person' |
'project'`) in both `types.ts` and `schema.ts`. A config-driven Zod registry
(`OPTIMIZATIONS.md §5`) lets users add custom types without forking the app.
**Effort**: High (schema, meta map, seed, type selector, graph theming all become
dynamic). **Impact**: Medium-high for power users.

---

## 5. Prioritized recommendation roadmap

**Phase A — correctness (do first, lowest risk, highest trust).**
1. F1 `Intl.Segmenter` tokenizer + CJK/accent regression tests.
2. F2 preserve claim provenance through sync.
3. F3 fix tombstone guard + its branch test.

**Phase B — architecture/performance.**
4. F5 route chat/AI retrieval through `searchAsync` + add abort.
5. F6 unify Library grid on BM25.
6. F4 cross-tab coordination (field-level merge via `mergeEntities`/`mergeClaims`).

**Phase C — store hygiene.**
7. Slice `store.ts` (chat/history/entities) before the next feature.

**Phase D — new features (one per PR, after A–C land).**
8. N2 Timeline view (quick win) → N4 claim extraction → N3 `@mentions`
   → N5 i18n string layer → N1/N6 semantic + offline LLM → N7 plugin types.

**Quality gates per PR** (per AGENTS.md): `pnpm run lint && pnpm run typecheck &&
pnpm run test && pnpm run build`, warnings treated as errors; data-model /
persistence / sync goals additionally require `pnpm run test:coverage` and
`pnpm run test:e2e`; dependency changes require `./scripts/verify-deps.sh`;
`./scripts/minimal_quality_gate.sh` before every commit; `code-review-assistant`
pass before merge.

---

## 6. Suggested next step

I recommend starting with **F1 (multilingual tokenizer)** because it is a
self-contained, high-impact correctness fix that also unblocks N1 and improves
the Library, Chat, and AI surfaces simultaneously. I can implement it (with
regression tests) as a single focused PR, then proceed through Phase A → B in
follow-ups. Please confirm priority and scope; alternatively I can dive straight
into one of the new-feature candidates (N2 is the smallest deliverable).
