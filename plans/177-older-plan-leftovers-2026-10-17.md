# Plan 177 — Older-Plan Leftovers: Palette, Export, Panel, and Filter Records

**Date:** 2026-10-17
**Status:** In progress — one PR (Plan 176 drained 150–175 + the Plan 131 G8 set;
this plan closes what the whole-folder sweep still found open in older plans)
**Method:** GOAP — the Plan 176 recon reported these as genuinely unmet; each was
re-verified against source before this plan was written.
**Related:** [ADR 017](ADRs/017-chat-unification.md) (chat unification, palette
pre-fill follow-up), Plans 20/049/058/062/071/131, Plan 176.

## Verified inventory

| # | Item | Source record | Wave |
| --- | --- | --- | --- |
| 1 | Command palette: the typed query is discarded when creating an entity — `startNew()` takes no name | ADR 017 "follow-up" | W1 |
| 2 | Command palette: no theme-toggle and no direct-export command | Plan 049 §118 | W1 |
| 3 | Exports show success/error but no busy state while a long export runs | Plan 20 §148-151 | W1 |
| 4 | Graph PNG export scales the live canvas 2×; no explicit 1920×1080 target | Plan 20 §148 | W1 |
| 5 | Right panel lists outgoing connections only; no "referenced by" (inbound) list | Plan 049 §116 | W2 |
| 6 | Library advanced filters (`tagQuery`, `hasDescriptionOnly`, `viewMode`, `showAll`) live in component state, so they are lost on navigation/reload | Plan 049 §117 | W2 |
| 7 | Ranked search runs synchronously on every keystroke (`rankEntitiesByQuery` inside the derived-list memo) | Plan 131 D2.9 | W2 |
| 8 | The palette's search never filtered commands: cmdk's filter is off (`shouldFilter={false}`) and only entity results were filtered, so the `typing filters command results` e2e spec could not fail for its stated reason | surfaced while fixing that spec | W1 |

## Discovered and fixed during this plan

The `command-palette` work exposed a defect the pre-existing e2e spec had been
unable to see: the palette's search box filtered **entity results only**. cmdk's
own filter is disabled (`shouldFilter={false}`, because the group order is
authored in the component) and nothing else filtered the command groups, so
typing `library` left every command visible — the spec asserted only that
"library" appeared somewhere, which was true before and after typing. Adding the
two new commands turned that vacuous assertion into a strict-mode collision,
which is how it surfaced. The palette now filters every command on its label and
hint (the create command stays visible: the typed query *is* its payload) and the
spec asserts both directions — the matching command visible, an unrelated one
gone.

## Decision closures (records only, with evidence)

| Item | Recorded ask | Resolution |
| --- | --- | --- |
| Verified-only graph filtering (Plan 04 §20) | "Decide whether this is an intended product requirement" | No product requirement exists anywhere in the record; the graph has no claim-verification filter and no acceptance criteria were ever written. Closed as a candidate, not scheduled. |
| Durable cross-tab tombstones (ADR 038) | "Decide against the current sync threat model; if persistence is required, add durable tombstones" | ADR 038's session-scoped tombstones remain the accepted boundary for local cross-tab storage events. This is distinct from Plan 131 G6's room/P2P Yjs tombstone persistence, which remains required and is tracked in Plan 178. |
| Rich PDF features (ADR 012) | "Select which deferred rich-PDF features are required" | The delivered scope (Helvetica text, no tables/images) is what the ADR's "Implemented" status describes; the deferred list was never prioritized. Recorded as a candidate list, not work. |
| Component consolidation (Plans 058/062) | "Finish consolidation … or close the remaining planned abstractions as unnecessary" | Verified: `ui/shared-primitives.tsx` already exports the shared set (`ViewHeader`, `ViewEmptyState`, `ConfirmDialog`, `Overlay`, inputs, toggles). The remaining local controls (`graph-toolbar.tsx` `ToolbarBtn`, `ai-harness-settings.tsx`) are single-consumer or differently-shaped by design; consolidating them would add an abstraction with one caller. Closed as unnecessary, with the reason recorded. |
| Pan/zoom through React state (Plan 131 D2.8) and per-node motion wrappers (D2.19) | Findings with suggested optimizations | Both need profiling evidence before an optimization is justified (D2.19's own wording: "if it is a material bottleneck"). Recorded as measured-before-change candidates; no acceptance criteria exist to satisfy. |
| Manual NVDA/VoiceOver pass (INDEX caveat) | "no manual NVDA/VoiceOver session is recorded" | Not agent-executable: it requires a human with a real screen reader. Remains a recorded human task; the automated equivalents (axe, ARIA assertions, live-region tests) are the coverage that exists. |

## Execution

| Wave | Owner scope | Files |
| --- | --- | --- |
| W1 | Palette + export | `command-palette.tsx`, `export-view.tsx`, `export-graph-png.ts`, export helpers/tests |
| W2 | Panel + library + search | `right-panel.tsx`, `library-view.tsx`, store slice/types for persisted filters, `store.ts` (`useDeferredValue` on the ranked list) |

## Earlier focused verification (before Plan 178 integration)

The results below are dated evidence for the earlier Plan 177 candidate only.
They do not verify the later cleanup, performance, quality, or sync work in
Plan 178; final integrated verification is recorded there.

- `./scripts/quality_gate.sh` (full) — lint, `typecheck`, `typecheck:test`,
  unit tests, shellcheck, `bats tests/`, markdownlint, reference-link validation all passed.
- `pnpm run build` — production build succeeded; precache manifest regenerated cleanly.
- `pnpm exec playwright test --project=chromium` — 214 passed (command palette,
  right-panel, library filter persistence, export surfaces).
- Fixed strict-mode locator collision in `e2e/command-palette.spec.ts` caused by
  both navigation and export commands mentioning "library", and wired manual
  command filtering so query filtering works for all palette commands.
- Ranked search computes from a deferred query; React documents this as an
  interruptible background render with no fixed delay (not a guaranteed frame).
- PNG export uses `HTMLCanvasElement.toBlob()` for the image Blob; the browser API
  defaults to PNG and may return `null` if encoding fails.

## Official references

- React, [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue):
  old value remains during the immediate render; deferred work is interruptible,
  with no fixed delay.
- MDN, [`HTMLCanvasElement.toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob):
  encodes a canvas image as a Blob; PNG is the required fallback format.
- Zod, [Defining schemas](https://zod.dev/api#objects): `z.object()` strips
  unrecognized keys by default; the envelope test pins that policy.
