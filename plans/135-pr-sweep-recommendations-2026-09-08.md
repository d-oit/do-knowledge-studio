# Plan 135 — Open-PR Sweep & Recommendations (2026-09-08)

**Type**: Progress / remediation record
**Scope**: All open PRs as of 2026-09-08 07:00 UTC (11 PRs: 8 dependabot, 3 feature).
**Status**: All 11 merged to `main`; production CI green (15/15 on `f667004`).
**Related**: ADR 028, ADR 038 (new), Plans 132/133/134

---

## 1. Outcome

| PR | Title | Verdict | Merged |
|----|-------|---------|--------|
| #758 | feat(sync): cross-tab store coordination | Reviewed hard; 5 fix rounds (see §2) | `f667004` |
| #759 | fix: validate AI settings IndexedDB persistence | Valid; threat-model claims corrected | `43c34b8` |
| #760 | feat(store): unify Library grid on BM25 | Good behavior unification; nits fixed | `1bb33a8` |
| #761–#768 | dependabot bumps (pnpm action, trufflehog, actionlint, radix ×3, sharp, jest-dom) | All safe pins; CI-verified | `9483df2`…`559c973` |

Threads resolved: **#758 ×15+**, **#759 ×3**, **#760 ×4** — every one replied with
fix evidence, then resolved via GraphQL (`resolveReviewThread`), unblocking the
`required_review_thread_resolution` gate.

## 2. Substantive findings fixed

- **#758 (cross-tab sync)**
  - P1 deletion resurrection via tombstone-less `storage` fallback → session
    tombstone registry (`cross-tab-tombstones.ts`), applied to both merge sides
    and aggregated across BroadcastChannel snapshots (see ADR 038).
  - Canvas `undefined` clears were stripped by Zod sanitization → explicit `null`
    sentinel in the persisted envelope + `.nullable()` schema fields +
    null→undefined normalization at the store boundary.
  - Dangling claims and stale `links` after remote entity deletion → cascade
    cleanup mirroring local `deleteEntity` (ADR 028 invariant).
  - `stopCrossTabSync` used-before-define; canvas-only changes never broadcast;
    unvalidated channel deletion metadata; wall-clock-dependent tests; fake
    channel delivery unasserted.
- **#759 (AI settings validation)**
  - `z.string()` accepted `''` model → `min(1)` on provider/model + regression
    test (chat passes `model` straight to `sendChatStream`).
  - Threat model claimed new tabs cannot decrypt — false (opener tabs copy
    `sessionStorage`; verified against MDN). Corrected; confirmed in-app links
    use `rel="noreferrer"` (implies `noopener`).
  - `applyStoredSettings` use-before-define; `migrateModel` complexity 6.
- **#760 (BM25 library grid)** — magic number `100` → `MIN_SEARCH_CAPACITY`;
  one/two-char identifiers renamed; selector complexity 10 → extracted
  `rankEntitiesByQuery` / `sortEntitiesBy`. Documented: with a search query the
  sort dropdown is intentionally inert (BM25 order, reversed for `asc`).

## 3. Recommendations & follow-ups

1. **Bot comment noise (do next)** — GitNexus and DeepSource re-post the same
   positional findings as *new* unresolved threads on every push (observed 4× on
   #758), and `required_review_thread_resolution` turns each re-post into a merge
   blocker. Switch both integrations to check-summary/annotation-only reporting
   and rely on the Codacy status gate. Recorded as LESSON-034.
2. **Tombstone durability (do next)** — tombstones are session-scoped; a tab that
   reopens *after* a cross-tab deletion can still resurrect the item via hydration
   (union-merge limitation). See ADR 038 for the durable-envelope-tombstone
   option. Low priority for local-first single-user flow.
3. **Test hardening (P3)** — `isApplyingRemoteUpdate` test samples the flag only
   before/after a synchronous apply; instrument a mid-apply assertion (store
   subscribe spy) so a guard regression can fail. 30-min task, deferred.
4. **Release draft (on request)** — candidate: "3 features + 8 dep bumps" release
   ✂ `v0.2.x` — see §4 draft notes. **Do not publish without explicit instruction**
   (AGENTS.md hard rule); the `version-propagation.yml` workflow is retired.

## 4. Draft release notes (not published)

> **Knowledge Studio — cross-tab sync, hardened AI settings, unified library search**
>
> - **Cross-tab store coordination (#758)**: field-level merge of corpus edits
>   across tabs via BroadcastChannel + `storage` events; deletion propagation with
>   re-creation arbitration; canvas state (graph/mindmap/links/tags) syncs
>   including clears; session tombstone registry prevents stale-snapshot
>   resurrection (ADR 038).
> - **AI settings (#759)**: IndexedDB persistence validated with the shared Zod
>   schema (provider/model required non-empty, read-back verified before
>   migration completes); threat model documented accurately (opener-copied
>   `sessionStorage`, legacy plaintext `apiKey` until re-entered).
> - **Library (#760)**: search now ranks by BM25 across entities **and claims**,
>   unifying relevance with chat/AI; sort field applies when no query is active.
> - **Dependencies**: pnpm/action-setup v6.1.0, trufflehog 3.97.4, actionlint
>   1.73.4, sharp 0.35.4, radix tooltip/dropdown-menu/scroll-area patches,
>   jest-dom 7.0.1.