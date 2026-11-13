# Plan 194 — Ordered implementation of open issues #1050–#1065 (2026-11-03)

**Status**: Complete (2026-11-13) — all 16 issues #1050–#1065 are CLOSED and every implementation PR is merged into `main` at `a395626`. Per-issue PRs: #1084 (#1050), #1086 + follow-up #1087 (#1062), #1088 (#1065), #1089 (#1055), #1090 (#1054), #1091 (#1056), #1092 (#1058), #1093 (#1053), #1094 (#1060), #1095 (#1052), #1096 (#1057), #1097 (#1051), #1098 (#1059), #1099 (#1061), #1100 (#1063), #1101 (#1064).
**Goal**: Complete every currently open issue #1050–#1065 in a dependency-safe sequence, with one focused PR per implementation unit and squash merges only after local gates, all CI, and code review pass.
**Constraints**: Preserve local-first operation, fail-closed persistence/import, strict TypeScript, current PWA/offline behavior, and no required backend. Do not close an issue on historical plan text alone; verify current code and attach the merge/verification evidence.

## Audit snapshot

The issue descriptions were checked against current source, plans, and open PRs. The six audits were read-only; no tests or builds were run. Existing partial work is reused rather than duplicated.
The sequence now starts from post-merge `main` at `c4af33b`; 15 open issues remain. #1062’s baseline has no `fast-check` or Stryker dependencies/property suite.

| Issue | Current status | Material remaining acceptance work |
|---|---|---|
| #1050 | Merged via PR #1084 | S1–S3 complete; final local quality gate, BATS suite, manual review, and required GitHub checks passed. |
| #1051 | Partial, security constraints unresolved | Narrow `connect-src`, remove script `unsafe-inline`, add all-view/offline CSP E2E and update ADR 045. Current ONNX runtime demonstrably executes JavaScript `eval`, so dropping `unsafe-eval` without replacing that runtime would break semantic search. Preserve that behavior while evaluating safe alternatives; do not weaken offline support. |
| #1052 | Done (PR #1095) | ICE/TURN settings with encrypted credentials (`src/lib/sync/ice-config.ts`, `ice-settings.ts`), connection/candidate diagnostics (`diagnostics.ts`), Sync-integrated file fallback and self-hosting docs. See Plan 200 and ADR 045. |
| #1053 | Done (PR #1093) | 500/2k/5k budgets in `graph-layout.bench.test.ts`, spatial-hash + chunked placement, viewport culling with letterboxing, zoom LOD, partial-render notice; baselines in `plans/perf-baselines.md`, ADR 052. Frame-rate target not asserted (no browser frame harness). |
| #1054 | Done (PR #1090) | Multi-file/folder/Obsidian Markdown import, frontmatter and two-pass wikilink/relative-`.md` resolution, streamed zip guards, stub/conflict preview rows, export round-trip parser, restore E2E. |
| #1055 | Done (PR #1089) | `[[...]]` editor tokens/export/import, name+tag alias resolution (no schema migration), unlinked-mention indexing, rename behavior, keyboard/SR tests. ID-based `@` mentions remain the canonical storage link. |
| #1056 | Done (ADR 050 + Plan 196) | ADR compares bundle CLI / local bridge / browser registration and selects the offline CLI; `packages/dks-mcp` serves read-only tools over stdio, Zod-validates arguments, mirrors OKF trust derivation, and ships an SDK contract test plus client docs. `find_path` is deferred to #1058. |
| #1057 | Open | Provider-backed extraction into an isolated proposal inbox, bounded Zod validation, provenance/privacy disclosure, explicit accept/edit/reject, evaluation and undo. |
| #1058 | Done (Plan 197 + ADR 051) | Pure BFS path/filter API with accessible list results, Zod-validated named views in the store envelope and backup `data/canvas.json`, AI `find_path` tool, and the MCP `find_path` deferral from #1056 closed. |
| #1059 | Open | Incremental duplicate/contradiction candidate detection, dismissals persisted and synced, user-confirmed actions, labeled fixtures and metrics. |
| #1060 | Done (PR #1094) | Separate durable per-entity revision store, quota/retention, restore UI, merge/import revision tags, optional backup inclusion, latency evidence. |
| #1061 | Open | PWA share-target intake and offline queue, safe transient capture/confirmation, URL clipper/bookmarklet and support documentation. |
| #1062 | In progress | Add bounded `fast-check` properties, scheduled/on-demand Stryker with reproducible seeds and reports, survivor triage, and contributor guidance. |
| #1063 | Partial | Current dynamic PDF/DOCX imports are already lazy. Still need current before/after route/chunk evidence, `sharp` production-dependency decision, unused-code advisory CI and final precache verification. |
| #1064 | Open | Generated README visuals, new-profile choice, accessible/reduced-motion/i18n tour, persisted completion/replay, privacy panel and E2E. |
| #1065 | Partial | RRF, text signal badges, fallback, evaluation and chat/context integration exist. Complete the requested worker-backed/non-blocking semantic path and explicit Hybrid/default-when-ready mode, with evidence that evaluation remains honest and regressions are bounded. |

### Issue #1050: S1–S3 recheck

- **S1 — skill catalog:** already resolved on `main`; the canonical
  `verify-before-asserting` skill appears once in the generated catalog. The
  current generator reports 58 skills, and its two-run idempotency test passes.
- **S2 — command documentation:** still open in `agents-docs/MANIFEST.md` and
  ADR 029, which advertised a nonexistent `generate-docs` subcommand. This PR
  documents the actual `sync`/`validate` interface and the separate catalog
  generator. `SKIP_LINKS` appears only as a historical/audit mention, not an
  active recommendation.
- **S3 — link strategy:** the manifest’s ambiguous `relative` value did not
  describe both existing layouts. Claude/Gemini/Qwen use per-skill relative
  links; Cursor/Windsurf use relative directory links. This PR names and
  validates both strategies explicitly.

## Dependency and merge order

Each numbered step is a separate main-target PR and is merged before the next dependent implementation begins. #1056 has a design-only ADR PR first and a later implementation PR; its issue remains open until the implementation PR satisfies all criteria.

1. **#1050 — agent-surface source of truth.** Validate/generated root instruction surfaces and reconcile current docs/ADR drift. Establishes clean tooling for subsequent work.
2. **#1062 — sync/migration property and mutation harness.** Pin actual merge, tombstone, hydration and migration invariants before changing sync or persistence behavior.
3. **#1065 — finish hybrid search.** Move semantic retrieval to the worker-backed path, define mode/default behavior, and preserve measured lexical fallback; required by #1059.
4. **#1055 — Wikilinks and aliases.** Establish canonical resolution and Markdown token behavior before importing vault links.
5. **#1054 — Markdown/Obsidian import.** Reuse #1055 resolution; enforce bounds before staging any mutation.
6. **#1056 — design ADR only.** Compare offline bundle CLI, localhost bridge, and browser-native registration; select the least-privilege offline option before implementation.
7. **#1058 — graph query and saved-view model.** Deliver the pure `find_path`/filter API and durable saved-view contract.
8. **#1053 — graph scalability.** Measure and optimize the graph renderer against the finalized query/view model; do not claim 5k performance without a reproducible profile.
9. **#1056 — offline read-only MCP implementation.** Consume the exported bundle and reuse #1058 `find_path`; no default mutation tools.
10. **#1060 — persistent entity revision history.** Use a separate IndexedDB store and quota-safe path; preserve restore-as-new-revision semantics.
11. **#1052 — ICE/TURN diagnostics and file sync.** Build on #1062 test semantics and #1060 revision capture for pre-merge history; update ADR 045.
12. **#1057 — Synthesis Inbox.** Keep model output outside canonical entities/claims until a user accepts validated proposals.
13. **#1059 — claim conflict suggestions.** Reuse #1065 semantic indexing; persist dismissals and keep all claim changes user-confirmed.
14. **#1061 — quick capture.** Integrate PWA share intake with the safe import/capture path from #1054 and preserve worker/cache upgrade identity.
15. **#1064 — onboarding and README visuals.** Ship after import/capture flows exist so the first-run choices and tour lead to real destinations.
16. **#1063 — dependency/bundle hygiene.** Measure the feature-complete baseline, prune/justify dependencies and unused code only after all new callsites exist, then measure after and verify precache parity.
17. **#1051 — CSP hardening.** Last, after all supported AI/sync/model endpoints are settled. Do not remove `unsafe-eval` unless the chosen runtime is proven to work without it; do not switch to dynamic nonce rendering without proving the static/offline contract. If the runtime constraint cannot be removed safely, record the exact unmet criterion and prerequisite rather than shipping a broken semantic path.

## Delivery gate per PR

- Issue-specific skill loaded before editing; relevant Next.js local guide read before any Next code change.
- Acceptance behavior covered by targeted tests and a real smoke path. Storage, import, sync, hydration, backup and offline changes also get their required browser/E2E evidence.
- Update the relevant plan/ADR/docs in the same PR. Keep source files under 500 LOC and user-facing strings in the existing message catalogs.
- Run `./scripts/quality_gate.sh` (including any required E2E) with warnings treated as failures. Confirm all GitHub checks, including Codacy and e2e, pass; resolve every review thread; run `code-review-assistant` and address all P1/P2 findings.
- Merge with `gh pr merge <PR> --auto --squash --delete-branch`; never bypass branch protection. Continue only after the required PR is merged.

## Official documentation consulted

- Next.js 16 [CSP guide](https://nextjs.org/docs/app/guides/content-security-policy):
  nonces are generated through Proxy and require dynamic rendering; static
  optimization/ISR are disabled. Re-evaluate this against the existing
  precache/offline contract before adopting a nonce design.
- MCP TypeScript SDK [first-server guide](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server):
  `serveStdio` owns stdio, tool inputs use Zod, and stdout is reserved for
  protocol messages (diagnostics go to stderr).
- Chrome [Web Share Target guide](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target):
  an installed PWA is required; POST/file payloads are handled through the
  service worker fetch event.
- fast-check [Vitest integration guide](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/):
  property generators integrate with Vitest and support seed-based replay.
- fast-check [configuration reference](https://fast-check.dev/docs/configuration/):
  set a seed and shrink path per property to replay a failing case exactly.
- StrykerJS [Vitest runner guide](https://stryker-mutator.io/docs/stryker-js/vitest-runner/):
  configure the dedicated runner plugin and mutation-score thresholds.
- StrykerJS [configuration reference](https://stryker-mutator.io/docs/stryker-js/configuration/):
  `ignorePatterns` omits test-irrelevant files from the sandbox and
  `appendPlugins` adds a runner without replacing defaults.
- StrykerJS [troubleshooting guide](https://stryker-mutator.io/docs/stryker-js/troubleshooting/):
  pnpm plugin auto-discovery can require explicit plugin configuration.
- MDN [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers):
  workers execute outside the window global, communicate by messages, and use
  copied or transferred data; bundlers resolve worker URLs relative to
  `import.meta.url`.
- Hugging Face [Transformers.js Next.js tutorial](https://huggingface.co/docs/transformers.js/tutorials/next):
  load the model pipeline and run inference inside a worker, reporting progress
  to the main thread through messages.
- StrykerJS [mutant states and metrics](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/):
  detected mutants are killed or timed out; valid mutants also include
  survivors and no-coverage results.
- GitHub Actions [workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions):
  job timeouts are capped at 360 minutes, so the full mutation scope is split
  across 240-minute source-file shards.
- GitHub [manually running a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow):
  `workflow_dispatch` must exist on the default branch before it can be
  dispatched against a selected ref.
- [`actions/download-artifact` v8.0.2 README](https://raw.githubusercontent.com/actions/download-artifact/v8.0.2/README.md):
  artifact pattern downloads retain per-artifact directories for aggregation.
- Zod [basic usage](https://zod.dev/basics): `safeParse` returns
  `success: false` for invalid input rather than throwing.
- StrykerJS [static mutants](https://stryker-mutator.io/docs/mutation-testing-elements/static-mutants/):
  static mutants require startup-time test runs; `ignoreStatic` removes them
  from mutation-score accounting.
- Yjs [document updates](https://docs.yjs.dev/api/document-updates): updates
  converge across peers when delivered and can carry transaction origins for
  filtering provider echoes.

## #1062 Property design

- Snapshot merge tests cover idempotence and pairwise commutativity after
  canonicalizing unordered fields. They do not assert arbitrary field-merge
  associativity: ADR 027 states that vector clocks provide causality but do
  not merge field-level CRDT state.
- Yjs update properties cover all arrival orders for two or three replicas,
  duplicate application, and both groupings of a three-update merge.

### Unordered-array reconciliation feedback

Review found a potential peer-update feedback loop: tag and link merges preserve
local-first array order, while payload equality treated order-only differences
as changes. The pre-fix reconciliation regression observed one unnecessary Yjs
update (`expected 0, received 1`) for equal tag/link sets in reverse order.
`sameEntityPayload` now compares these set-valued fields by stable keys, so the
bridge does not publish an order-only rewrite. A connected-peer regression
seeds distinct concurrent tags and links, checks both canonical stores contain
the union, and verifies the persisted Yjs update sequence stays stable during
the quiet period. The focused unit test passed 3/3; the targeted Chromium E2E
passed 1/1; the strict E2E TypeScript check also passed. After rebasing,
`pnpm install --frozen-lockfile` and
`env -u NO_COLOR FORCE_E2E=true ./scripts/quality_gate.sh` passed: lint, both
typechecks, full Vitest and Playwright E2E, ShellCheck, BATS, and markdownlint.
PR CI, code review, the main-branch mutation matrix, and merge remain pending.

The test reads the highest key in `y-indexeddb`’s auto-incrementing `updates`
store; MDN confirms deleting or clearing records does not decrement the key
generator ([Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)).

### Causal clock device-key regression

The first 2,000-run nightly profile found a failure after 465 cases:
seed `10622026`, path `464:0`, counterexample `[[],"constructor"]`.
`CausalClock` accepts every non-empty string key, and `getDeviceId()` returns a
persisted `dks-device-id` value verbatim, so prototype-property names are
within the current input contract. Plain-object inheritance caused clock
advancement and comparisons to read inherited functions instead of absent
counters.

`nextRecordClock` now accumulates into a null-prototype object; clock comparison
uses own-property reads. Deterministic cases cover `__proto__`, `constructor`,
and `toString`. A test-only pre-fix shadow oracle compares clock advancement,
dominance, and ordering on the same generated UUID-keyed inputs. The targeted
causality property suite passed 12/12; the reserved-key Yjs round-trip passed.

The causal suite also rejects arrays, primitives, empty device IDs, and
negative, fractional, or unsafe counters; explicit examples distinguish equal,
strictly ordered, and concurrent clocks.

Local browser canary: with `dks-device-id=constructor`, the seeded studio
created and edited an entity in a temporary sync room. The UI merged 9 entities
and 5 claims; the `dks-sync` IndexedDB update store contained 3 updates after
the second edit, with no browser errors. Peer count remained 0, so this
verifies the local bridge/persistence path, not independent-peer convergence.
The corpus was the synthetic app seed; no user corpus was available or touched.

### Deterministic concurrent record propagation

The Chromium regression reproduced a real bridge defect: when inbound data
resolved to the value already in canonical Zustand, the bridge returned early
and never propagated that winner back to the peer. The new
`reconcileMergedRecords` writes merged entity and claim values to Yjs with the
outbound origin, while excluding unresolved causal delete conflicts so the
manual resolution path remains authoritative. The new bidirectional-bridge
regression failed before the fix and passed after it (14/14 bridge tests).
The isolated multi-device Chromium scenario then passed (1/1). Yjs document
updates are commutative/idempotent and support origin-tagged update filtering
([Yjs document update docs](https://docs.yjs.dev/api/document-updates)).

### Stryker sandbox setup

Initial runs found generated skill-directory symlinks that Stryker could not
copy. After excluding those test-irrelevant surfaces, pnpm plugin discovery
still missed the Vitest runner and treated `vitest` as an unknown option.
`stryker.config.json` now excludes only skill surfaces and appends
`@stryker-mutator/vitest-runner`; the configured scope also includes the new
bridge reconciliation module.
The expanded nightly property profile took 122.38s. The original 12-module
local Stryker baseline took 524m08s (8h44) and produced 1,907 mutants:
1,201 killed, 85 timed out, 423 survived, 198 with no coverage, and zero
errors (67.44% under Stryker's valid-mutant denominator). The baseline full
report predates the final tombstone and causality regression tests. Replacing
only those two module reports with their focused reruns yields a local
composite of 1,907 mutants: 1,209 killed, 86 timed out, 414 survived, 198 with
no coverage, and zero errors (1,295/1,907 detected; 67.91%). The complete
matrix remains required for final CI evidence.

The final focused tombstone rerun had 125 mutants: 123 killed, one timed out,
one survived, and no no-coverage or error results (99.20%). The survivor is
the line-105 missing-data guard: when the map lookup yields `undefined`,
`safeParse(undefined)` returns `success: false`, so the later condition returns
`null` without the explicit guard. The line-49 timeout is recorded as a timeout,
not a kill; Stryker counts it as detected. This run warned that 12 static
mutants accounted for an estimated 79% of test runtime. They remain in scope:
`ignoreStatic` would exclude them from the score. The focused shard completed
in 2m09s.

The focused causality rerun had 81 mutants: 76 killed and five survived, with
no timeout, no-coverage, or error results (93.83%). All five survivors are
equivalent for clocks accepted by `isCausalClock`, which requires non-negative
safe-integer counters. The two line-31 `clockDominates` mutants remove the
first-loop `advanced` assignment; the second loop revisits each left-clock
entry and sets the flag whenever that component exceeds the corresponding
right counter. The three `compareClocks` mutants alter the final equality
predicates at lines 43–44.
Prior strict-dominance checks return for any positive component difference;
absent counters read as zero, so after those checks the two equality predicates
are either both true (equal values, including explicit zero keys) or both
false (concurrent clocks). Replacing `&&` with `||`, or either predicate with
`true`, does not change the reachable result.

The final reconciliation shard mutated 22 cases: 21 killed and one surviving
static string-literal mutant at `ORIGIN_OUTBOUND`. Replacing the origin string
with `""` remains equivalent because the bridge filters against the same
shared constant. The shard passed both claim-scoped tombstone-clock and
unresolved-delete exclusion invariants; it completed in 68 seconds.

Combining the updated 12-module composite with this focused shard, then running
the repository aggregator against all 13 configured files, yields 1,929 mutants:
1,230 killed, 86 timed out, 415 survived, and 198 with no coverage (68.22%;
1,316/1,929 detected). This is a local composite, not a full 13-module run; CI
must provide the complete matrix.

The full baseline also has one surviving mutation in
`cross-tab-tombstones.ts:33`: `timestamp > existing` changed to `>=`. Equal
timestamps write the same number to the same `Map` key, preserving its value
and insertion order; the mutation has no observable effect.
Because GitHub job timeouts cap at 360 minutes, the workflow runs one source
file per 240-minute shard, with at most four shards in parallel. Expanded
properties use a separate 30-minute job. The aggregator requires every shard
to succeed, validates all 13 module reports exactly once, applies the 60%
global score floor, and retains shard and aggregate artifacts for 14 days.

## Progress

- [x] Enumerate all 16 open issues and inspect existing code/plans.
- [x] Record dependency order and delivery gates.
- [x] #1050 S1–S3 and implementation: generated instructions, manifest-derived
  labels, explicit per-tool link strategies, and Claude skill-link tracking.
- [x] Targeted smoke: 33 BATS tests, `setup-skills.sh`, and
  `validate-skills.sh`. Mutation probes caught drift and link-target defects;
  re-injected validator/path-boundary defects made their regressions fail.
- [x] First PR #1084 Quality Gate failure diagnosed: `.claude/` ignored new
  links in a clean checkout. `.gitignore` now keeps local Claude state ignored
  while exposing manifest-managed skill links.
- [x] Code review found dropped `validate_broken_links`/`validate_agents_md`
  calls and unbounded manifest paths. The calls were restored; path resolution
  now rejects escapes.
- [x] Final `./scripts/quality_gate.sh` after the review fixes: all local gates
  passed.
- [x] PR #1084 merged as `c4af33b`; all required GitHub checks passed, `./scripts/quality_gate.sh` passed, and manual review found no P1/P2 issues.
- [ ] #1062: Bounded properties, scoped nightly/on-demand Stryker, and
  CONTRIBUTING replay guidance implemented. The causal property suite passed
  12/12; doc-rejoin passed 12/12; mutation-score aggregation passed 6/6; and
  seed `10622026`/path `464:0` replay passed. The expanded nightly profile passed
  237 files with one skipped, 3,289 tests passed and four skipped in 127.99s.
  Full local Stryker baseline and the focused updated composite are recorded
  above; tombstone, causality, and cross-tab tombstone survivors are triaged.
  Full coverage then passed 237 files with one skipped and 3,289 tests passed
  with four skipped; aggregate coverage was 88.63% statements, 79.55% branches,
  85.25% functions, and 89.94% lines. Coverage initially exposed a 5-second
  timeout in the graph pan stress test; batching its 250 key events inside
  `act` preserved the clamp assertions and the focused coverage test passed.
  Full `pnpm test` passed 237 files with one skipped and 3,289 tests passed
  with four skipped in 123.70s. The four default-profile property files passed
  23 tests in 4.65s.
  The concurrent-edit Chromium case reproduced peer divergence before the fix.
  The unit regression failed before and passed after; the isolated Chromium
  case passed 1/1, and the combined bridge/reconciliation unit run passed 16/16.
  Final `pnpm run test:coverage` passed 238 files with one skipped and 3,292
  tests passed with four skipped; coverage was 88.63% statements, 79.68%
  branches, 85.25% functions, and 89.95% lines.
  Final `FORCE_E2E=true ./scripts/quality_gate.sh` passed: lint, both
  typechecks, full Vitest, full E2E, shellcheck, BATS, and markdownlint. The
  first run found a bare Yjs docs URL here; it was linked and the full gate
  passed on rerun.
  PR #1086 merged as `840f42f` on 2026-11-04 with review and all required
  checks green; the default-branch mutation workflow and the tombstone /
  causality / cross-tab survivor triage are recorded above. Follow-up #1087
  (deterministic same-instant claim history) merged 2026-11-05. Issue #1062
  closed.
  Codacy flagged three non-literal file-access calls in the report checker; it
  now consumes report JSON on stdin and statically imports the configured
  scope instead of opening caller-selected paths. Checker tests and the
  68.22% local composite pass, and Codacy reanalysis passed on #1086.
- [x] #1054 implementation and review fixes: vault + export-shape parsers,
  streamed zip reader, staging extracted to `import-staging.ts` (hook 475→381
  LOC), same-name dedupe, synchronous JSON routing restored. Lint/typecheck/
  test (243 files, 3,361 tests)/build green; vault E2E 2/2. PR #1090 merged as
  `8212a49`.
- [x] #1056 ADR 050 accepts the offline bundle server (A) and rejects the
  localhost bridge (new required daemon, live socket to defend) and browser
  registration (API availability). `packages/dks-mcp` ships reader guards
  (zip-slip paths, entry/size caps, versioned index), claim/trust mirroring,
  BM25-lite search, five read-only tools, and an InMemoryTransport contract
  test. Review fixed character-vs-token length normalization (the regression
  test failed with the defect injected), a duplicated default limit, and a
  swallowed handler error; root vitest now excludes `packages/**` so the
  package suite runs once. Gates: lint, both typechecks, 3,361 root + 17
  package tests, build, CLI smoke over a real bundle directory.
- [x] Created, reviewed, and merged every remaining issue PR in the recorded
  dependency order (PR list in the status line above). Audit of 2026-11-13:
  `gh issue list --state open` returns 0, and `gh issue view` reports CLOSED
  for each of #1050–#1065.

## Closeout (2026-11-13)

The ordered track is finished; this plan is retained as the record of the
sequence and its per-PR gates. No issue in the #1050–#1065 range remains open,
so no further work belongs to this plan. New work must open a new numbered plan
rather than extend this one. Local `main` was fast-forwarded to `a395626` and
the merged `feat/1064-onboarding-tour` branch was deleted in the same sweep.
