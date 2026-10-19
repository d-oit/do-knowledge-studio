# Plan 178 — Remaining Active Plan Tasks: Reconcile, Implement, and Verify

**Date:** 2026-10-18
**Status:** Candidate implementation and full production E2E complete; local quality gate passed; PR delivery remains in progress;
independent-peer canary remains blocked on WebRTC/ICE.
**Method:** GOAP with parallel audit and implementation waves  
**Related:** Plans [131](131-goap-swarm-improvement-audit-2026-08-22.md), [162](162-roadmap-progress-and-next-work-2026-10-05.md), [165](165-backlog-remediation-2026-10-13.md), [169](169-touch-gesture-specification-2026-10-15.md), [176](176-plans-backlog-drain-2026-10-17.md), [177](177-older-plan-leftovers-2026-10-17.md), and [ADR 027](ADRs/027-canonical-state-and-p2p-sync-bridge.md).

## Goal and scope

Close every still-actionable, source-confirmed implementation task in the active plan backlog in one reviewed PR. Reconcile stale closure claims against current code, preserve the historical record, and keep conditional, unprioritized, and human-only items explicitly classified instead of silently counting them as done. No required backend, no new feature beyond recorded acceptance criteria, and no plan-status-only closure.

## Verified inventory so far

| Area | Current status | Evidence / scope |
| --- | --- | --- |
| Plan 177 W1–W2 | Integrated candidate; full production E2E and local quality gate passed; PR/CI review pending | Palette, exports, graph PNG, backlinks, library filters, deferred search, and command filtering. Earlier Plan 177 checks are dated evidence for that candidate only. |
| Plan 03 | Historical architecture, not actionable backlog | Vite/SQLite-WASM/OPFS CLI was superseded by Plan 048 and ADR 018; tiered IndexedDB backup was not selected and the unused module was removed by Plan 166. |
| Plan 133 | GraphView target implemented | `src/components/studio/views/graph-view.tsx` is now 349 LOC, below the recorded <350 LOC target. Worker retrieval and bounded AI context already exist; IndexedDB backup was not selected. |
| Plan 131 G1–G2 | Unit, production E2E, and local quality gates passed; real-corpus persistence validation remains pre-merge | Persistence matrix and unknown-key policy are represented in `schema.ts` and `store-persist.test.ts`; claim-aware undo/redo, deletion restoration, batched child creation, selection reconciliation, and abortable chat paths are covered. |
| Plan 131 G3 | Source cleanup and dependency override audit complete; local quality gate passed | Root scratch moved under `plans/`; unused wrappers/config removed; `.env.example`, README and references updated; eight redundant/tree-empty override entries removed. Fourteen remaining overrides have active dependency paths; historical alert provenance is recorded below. |
| Plan 131 G4–G5 + Plan 177 | Integrated implementation; full production E2E and local quality gate passed; PR/CI review pending | Deferred ranked search, lazy Editor leaves and Chat, reduced-motion-aware CSS replacements, shared navigation/empty-state/search/dialog primitives, keyboard ownership, shortcuts state, export busy/PNG behavior, library filter persistence, inbound backlinks, and GraphView decomposition are in source. |
| Plan 131 G6 | Bridge implementation integrated; same-origin synthetic create/update/delete/rejoin passed, but independent-origin P2P canary is blocked | Canonical Zustand↔Yjs updates, room-scoped durable tombstones, vector clocks, validated conflict resolution, join/resync reconciliation, cursor/presence teardown, and signaling configuration are implemented. Independent origins joined signaling but remained at Peers 0; conflict/offline/reload behavior on an independent peer remains unverified. |
| Plan 131 G7–G9 | Source work, full production E2E, and local quality gate passed; conditional profiles completed | Hook validation, Vitest cleanup/parallelism, test-source typechecking, shared fixtures, separate benchmarks, retrieval map, grouped props, shared breakpoints, chat/editor timing, citation mutation coverage, TypeScript/Node decisions, app tsconfig, package identity, and historical report cleanup are addressed. D2.8/D2.19 profiles are recorded in `plans/perf-baselines.md`; no material frame or long-task regression at eight entities, but real-corpus evidence remains. |
| Plans 162/165/166/169/176 | Reconciled; only explicitly unprioritized/human-only items remain | F3 gestures and the S3 Cursor/Windsurf symlink strategy are implemented; first-mount reduced motion is an accepted tradeoff, and NVDA/VoiceOver requires a human. |
| Plan 158 | Closed | Its dated reconciliation says all audit items are closed; Plan 176 and later records provide closure evidence for the listed P2 follow-ups. |

### Legacy unchecked-box audit

The whole-folder audit found no actionable implementation item missing from this plan. Historical unchecked boxes resolve to work already shipped, stale architecture, explicit optional/unprioritized candidates, or human-only checks. Preserve those original records; do not treat an old checkbox as a current requirement without source and acceptance evidence.

| Plan family | Disposition |
| --- | --- |
| 001, 03, 05, 040–042, 051, 078, 14/16–20, 33–37 | Implemented, superseded by Next.js/Zustand/ADR 018, or historical workflow tracking; no additional current requirement. |
| 04, 17, 068, 133 | Graph revision and mandatory gestures shipped; optional Mind Map swipes, verified-only graph filtering, Visual Query Builder, and speculative virtualization remain unprioritized. The GraphView LOC target is tracked above. |
| 13, 176 | API-key migration is closed by Plan 176; no residual plaintext migration item. |
| 163–165 | Follow-ups are closed by Plans 164–176 or explicitly retained as candidates/human tasks; Plan 165’s older S3 wording is clarified by its 2026-10-16 Plan 162 reconciliation. |
| Manual validation | Screen-reader verification requires a human with NVDA/VoiceOver; automated axe/ARIA coverage is not represented as a substitute. |
| `plans/research/scratch/` | Resolver experiments and old swarm checklists are research records, not active product acceptance criteria. |

### Plan 131 G7–G9 source audit

| Goal | Implemented items / evidence | Deferred, conditional, or prohibited |
| --- | --- | --- |
| G7 — quality infrastructure | Required hook contents are validated; `SKIP_GLOBAL_HOOKS_CHECK` is removed; Vitest restores mocks and unstubs globals; `maxWorkers` uses the documented percentage; shared seed-based fixtures use UUIDs; `*.test-d.ts` sources are typechecked; wall-clock tests moved behind `test:bench`. | TypeScript 7 remains deferred because the current `typescript-eslint` compiler-API compatibility range excludes it. No ESLint/Biome configuration change is authorized. |
| G8 — library hardening | AI settings’ IndexedDB exception and threat/storage boundary are documented in ADR 018; `getEntityMap` exposes the existing cached retrieval index as `ReadonlyMap`. | Provider retry/settings migration work was already closed in Plans 165/176; no new storage implementation was added. |
| G9 — P2 hygiene | Shared undo bounds and SVG rasterization; GraphView <350 LOC; one Cmd+K event owner; TRIZ/test naming; shared suggestion chips; grouped export/AI settings props; shared CSS-token breakpoints; chat debounce race fix; inert table key removed; benchmark naming/config; editor fake-timer and citation mutation cases; package/Node/tsconfig updates; bundle report removed. | D2.8 pan/zoom state and D2.19 per-node motion change only if an actual profile shows material user-visible cost; measurements are recorded in the final verification section. Production-mode E2E server mode remains a maintainer workflow choice. |

### G3 dependency override audit

`pnpm why` confirmed every remaining override has a live transitive path; `pnpm install --lockfile-only --no-frozen-lockfile` regenerated the lockfile cleanly after removing eight obsolete entries.

| Active selector group | Live path / recorded provenance |
| --- | --- |
| `adm-zip` | `onnxruntime-node` → `@huggingface/transformers`; retained on the active path. |
| `brace-expansion@<1.1.18`, `brace-expansion@>=5` | `minimatch` consumers; Plan 156 records the 1.x and 5.x advisories and patched versions. |
| `browserslist`, `js-yaml` | Next/Babel and markdownlint; Plan 139 records the patched bounds and alert evidence. |
| `dompurify` | Transitive `jspdf` consumer; retained only for the active transitive path (Plan 111). |
| `katex`, `smol-toml` | markdownlint chain; Plan 172 records the advisories and patched floors. |
| `nanoid@3` | PostCSS requires the v3 line; Plan 126 records the security floor. `docx` independently uses v6. |
| `picomatch`, `postcss`, `postcss-selector-parser` | Active Next.js, ESLint, Vite, Tailwind, and typography paths. The original alert-group commit did not retain individual alert IDs for these selectors. |
| `source-map-js` | Tailwind/PostCSS/jsdom paths; Plan 163 records Dependabot alert #75 closure. |
| `undici` | jsdom/Vitest path; Plan 159 records the patched floor. |

Removed `lodash`, `lodash-es`, `defu`, `js-cookie`, `effect`, `prismjs`, and `diff` because `pnpm why` found no dependency paths. Removed the `sharp` override because its active direct dependency is already `^0.35.5`, satisfying both Next and Transformers; retained the direct dependency.

## GOAP execution waves

| Wave | Work | Dependency / exit |
| --- | --- | --- |
| 0 — Reconcile | Completed: source audit of Plan 131 G1–G9 and whole-folder unchecked boxes; retain conditional, historical, and human-only classifications | Evidence-backed inventory; no extra source-confirmed requirement omitted |
| 1 — Foundations | G1/G7 implementation integrated; run persistence regressions and verify gates measure application and test sources honestly | Focused and full checks pass without warnings |
| 2 — Cleanup and UI architecture | G3/G4/G5 and Plan 177 implementation integrated | Dependency audit and real-browser UI flows confirm the existing contracts |
| 3 — Library and hygiene | G8/G9 implementation integrated; profile the conditional D2.8/D2.19 candidates | Keep behavior unchanged unless measured impact meets the documented condition |
| 4 — Sync completion | G6 bridge implementation integrated | Compare old/new behavior on identical input, then exercise IndexedDB persistence and two-peer create/update/delete/conflict/rejoin in Chromium |
| 5 — Verify and deliver | Full local gates, coverage, production build, Chromium E2E, browser smoke, sync shadow/canary, review, and requested PR | All required checks green; no unaddressed P1/P2 or Codacy issues |

## Conditions and exclusions

- Plan 131 D2.8 (Graph pan/zoom state) and D2.19 (per-node motion) are measured-before-change candidates. Change them only if an actual profile demonstrates material user-visible cost; otherwise record the measurement and leave the behavior intact.
- Plan 169's optional Mind Map swipe actions and §4 double-tap/long-press were excluded by its own delivery table and Plan 162 addendum; they are not silently promoted to required scope.
- Synthesis Inbox and Visual Query Builder remain unprioritized candidates, not implementation tasks.
- Manual screen-reader verification requires a human screen reader and cannot be claimed from automated tests.
- Preserve useful historical/research content when cleaning root artifacts; migrate references rather than deleting content without evidence.

## Official API references

- React [`useDeferredValue`](https://react.dev/reference/react/useDeferredValue): deferred rendering is interruptible and has no fixed delay.
- MDN [`HTMLCanvasElement.toBlob()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob): creates an image Blob and may yield `null` on encoding failure.
- Zod [Defining schemas](https://zod.dev/api#objects): `z.object()` strips unrecognized keys by default.
- Yjs [Shared Types](https://docs.yjs.dev/getting-started/working-with-shared-types): shared-type changes are observed after transactions; batching reduces observer calls and outgoing updates.
- Yjs [Document Updates](https://docs.yjs.dev/api/document-updates): transaction origin distinguishes local/provider updates and can suppress redundant propagation.
- Zustand [`createStore`](https://zustand.docs.pmnd.rs/reference/apis/create-store): vanilla stores expose `subscribe` for external synchronization.
- Yjs [`y-indexeddb`](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb): IndexedDB readiness is asynchronous (`synced`); `provider.get/set` stores local document metadata that is not synchronized with peers.
- Yjs [WebRTC connection provider](https://docs.yjs.dev/ecosystem/connection-provider/y-webrtc): `y-webrtc` is the peer-to-peer transport; the canary reached signaling but did not observe a peer.
- Vitest [`unstubGlobals`](https://vitest.dev/config/unstubglobals), [`restoreMocks`](https://vitest.dev/config/restoremocks), and [`maxWorkers`](https://vitest.dev/config/maxworkers): cleanup defaults and percentage-based parallelism.
- Next.js [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript): app-only CLI checking uses a dedicated config; the installed Next 16 guide was also read at `node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md`.
- TypeScript [7.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) and typescript-eslint [dependency versions](https://typescript-eslint.io/users/dependency-versions/): TS7’s compiler-API removal and the parser’s supported TypeScript range inform the deferred upgrade decision.
- Playwright [`webServer`](https://playwright.dev/docs/test-webserver): official server lifecycle/options reference; changing the repository’s E2E server mode remains a maintainer workflow decision.
- Playwright [`Page.getByLabel`](https://playwright.dev/docs/api/class-page#page-get-by-label): `exact` defaults to `false`; requiring the whole label avoids matching the lazy-editor loading status when the test needs the textarea.
- pnpm [`package.json` settings](https://pnpm.io/package_json#pnpmoverrides): official override placement and semantics used for the dependency inventory.
- React [`lazy`](https://react.dev/reference/react/lazy): the load function resolves a module with a `default` component export; the lazy component must render under `Suspense`. This supports module-scope lazy boundaries for heavy views.
- React [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect): runs after DOM mutations and before paint;
  used to release the banner reservation only after its DOM removal.
- MDN [`transitionend`](https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event): the event does not fire when no transition runs or when a transition is cancelled; the offline indicator also uses a bounded fallback and cleanup.
- Next.js [`error.js` and `global-error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error): route boundaries wrap their segment, not the layout above it; root-layout errors require `global-error`, and `retry()` re-fetches and re-renders the boundary children.
- web.dev [Total Blocking Time](https://web.dev/articles/tbt): main-thread tasks over 50 ms count as long tasks; lab TBT is a proxy for responsiveness, not a field substitute for INP.
- Chrome DevTools [Analyze runtime performance](https://developer.chrome.com/docs/devtools/performance): profile runtime frames and CPU, simulate mobile CPU at 4×, and inspect frames against the 60 FPS target.

## Verification record

- Focused persistence and Plan 177 component suites: `pnpm exec vitest run ...` — 7 files, 285 tests passed, no TypeScript errors (2026-10-17).
- `pnpm run build` passed without warnings; generated 84 precache URLs with 76 supported assets (2026-10-18).
- Focused production E2E after correcting ambiguous Playwright selectors (`getByLabel` defaults to substring matching, so “Editor content loading” matched “Editor content”): all 52 tests across four Chromium viewport projects completed; 51 passed first attempt, and the tablet claim-extraction case passed on retry after its page/context closed during a click (2026-10-18).
- Offline-banner reservation ordering: the exit now hides the banner first; `useLayoutEffect` releases reserved space
  after DOM removal and before paint. Unit 4/4 and the mobile production E2E regression passed 10/10 repetitions
  (2026-10-18).
- Independent-origin sync canary: `localhost:3010` + `127.0.0.1:3012`, then `localhost:3010` + `127.0.0.1:3010`, joined the same synthetic room and each reported signaling connected; peer count stayed 0 after 10 seconds. Earlier baseline/candidate also stayed at 0. Same-origin two-tab synthetic create/update/delete/rejoin passed with `Peers: 1`, but the UI aggregates WebRTC and BroadcastChannel peers, so transport was not distinguished; this is not an independent P2P result. No cross-origin conflict, offline reconnect, or reload-persistence claim is made; an external peer that completes WebRTC/ICE is required.
- Full production E2E after the exact-label and banner-order fixes: 859 passed, 8 skipped, and 0 failures/flakes (867 total; 25.8
  minutes) across Chromium, mobile, tablet, and desktop-xl projects on isolated candidate port 3010. The mobile banner-exit
  regression passed 10 repeated runs; the editor readiness case passed three isolated repeats and the full run (2026-10-18).
- Final local quality gate: `SKIP_E2E=true ./scripts/quality_gate.sh` passed lint, both typechecks, Vitest, ShellCheck,
  BATS, markdownlint, links, and agent-surface validation. The full link pass checked 58 files and 211 links with no
  broken links (2026-10-18). E2E was skipped only because port 3000 is maintainer-owned; the production suite above
  ran separately on isolated candidate port 3010.
