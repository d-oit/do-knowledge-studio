# Plan 194 — Ordered implementation of open issues #1050–#1065 (2026-11-03)

**Status**: Active — acceptance audit complete; implementation underway.
**Goal**: Complete every currently open issue #1050–#1065 in a dependency-safe sequence, with one focused PR per implementation unit and squash merges only after local gates, all CI, and code review pass.
**Constraints**: Preserve local-first operation, fail-closed persistence/import, strict TypeScript, current PWA/offline behavior, and no required backend. Do not close an issue on historical plan text alone; verify current code and attach the merge/verification evidence.

## Audit snapshot

The issue descriptions were checked against current source, plans, and open PRs. The six audits were read-only; no tests or builds were run. Existing partial work is reused rather than duplicated.

| Issue | Current status | Material remaining acceptance work |
|---|---|---|
| #1050 | Local implementation complete; PR/CI pending | S1–S3 rechecked; generated instruction/labeler surfaces and explicit skill-link strategies are implemented. |
| #1051 | Partial, security constraints unresolved | Narrow `connect-src`, remove script `unsafe-inline`, add all-view/offline CSP E2E and update ADR 045. Current ONNX runtime demonstrably executes JavaScript `eval`, so dropping `unsafe-eval` without replacing that runtime would break semantic search. Preserve that behavior while evaluating safe alternatives; do not weaken offline support. |
| #1052 | Partial | ICE/TURN settings and encrypted credentials, connection/candidate diagnostics, Sync-integrated file fallback, TURN validation, docs and tests. Existing signaling URL configuration is not ICE configuration. |
| #1053 | Partial | 500/2k/5k/10k measurements and documented budgets; large-corpus renderer/culling and accessible fallback with evidence for the 5k target. |
| #1054 | Partial | Multi-file/folder/Obsidian Markdown import, frontmatter and two-pass link resolution, limits/fail-closed preview, round-trip and restore E2E. |
| #1055 | Partial | `[[...]]` editor tokens/export/import, alias resolution, unlinked-mention indexing, rename behavior, keyboard/SR tests. Existing ID-based `@` mentions are retained as the canonical storage link. |
| #1056 | Open | Required architecture ADR, offline read-only MCP CLI over exported bundles, provenance-preserving tools, SDK contract test and setup docs. |
| #1057 | Open | Provider-backed extraction into an isolated proposal inbox, bounded Zod validation, provenance/privacy disclosure, explicit accept/edit/reject, evaluation and undo. |
| #1058 | Open | Pure shortest-path/filter API, accessible results, named views persisted through reload/backup/sync, and AI `find_path` integration. |
| #1059 | Open | Incremental duplicate/contradiction candidate detection, dismissals persisted and synced, user-confirmed actions, labeled fixtures and metrics. |
| #1060 | Open | Separate durable per-entity revision store, quota/retention, restore UI, merge/import revision tags, optional backup inclusion, latency evidence. |
| #1061 | Open | PWA share-target intake and offline queue, safe transient capture/confirmation, URL clipper/bookmarklet and support documentation. |
| #1062 | Open | Bounded `fast-check` properties in normal tests, scheduled/on-demand Stryker with reproducible seeds and score/artifact, survivor triage and contributor guidance. |
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
- StrykerJS [Vitest runner guide](https://stryker-mutator.io/docs/stryker-js/vitest-runner/):
  configure the dedicated runner plugin and mutation-score thresholds.

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
- [ ] Commit/push review fixes, await all CI, complete final review, and merge
  #1084 before starting #1062.
- [ ] Create, review, and merge each issue PR in sequence; continue to #1062
  only after #1050 merges.
