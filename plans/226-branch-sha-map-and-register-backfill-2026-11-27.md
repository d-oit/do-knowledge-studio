# Plan 226: Branch-SHA map, ADR register backfill 029–038, issue #1204 triage (2026-11-27)

**Goal**: The three follow-ups offered after Plan 225: name the reachable commit
each orphaned branch SHA became, register the decision records the index still
omitted, and give issue #1204 an evidence-based verdict instead of leaving it
untriaged.

## Waves

| Wave | Goal | Status | Outcome |
| --- | --- | --- | --- |
| 1 | Map each unreachable branch SHA to the commit that carries its work | Done | 45 of 48 mapped by subject against GitHub and the squash bodies; 3 do not resolve on GitHub at all |
| 2 | Register ADRs 029–038 and lower the guard floor | Done | Nine rows added (039 does not exist); `ADR_REGISTER_FLOOR` drops 58 → 29, so every record from 029 onward is now enforced |
| 3 | Triage #1204 (Ladybird compatibility) | Done | Premises checked against Ladybird's alpha: WebDriver exists, IndexedDB is implemented, service workers are incomplete; kept open as opt-in and labelled |

## Wave 1 — the map

Method: for each unreachable SHA, read its commit message through the GitHub API
(the objects survive a squash), then find the commit on `main` whose message
carries that subject. Every row below is a claim a reader can check with
`git show <reachable>`.

| Reachable commit | Subject | Unreachable SHA(s) |
| --- | --- | --- |
| `720df583` | ci: cache Playwright browsers in main workflow (#584) | `c7a1a93` |
| `0dc9500b` | feat(export): implement ADR 010 full export schema + reconcile stale plan checks (#598) | `4df29fd` |
| `49bee999` | refactor(export): split export-helpers into types and documents modules (Plan 110) (#616) | `8a3e720`, `e2e34c9`, `7e6f5b3` |
| `5c684b2e` | fix(okf): address DeepSource, OwlWatch, and maintainer review feedback on PR #624 | `dfff869` |
| `1084236a` | chore(deps): bump dompurify from 3.4.12 to 3.4.13 (#625) | `2c9a400` |
| `987fb736` | fix(owlwatch): remediate issues 620-622 + Plan 111 reconciliation (#626) | `72c7efb` |
| `fb07b05e` | fix(ci): activate .deepsource.toml JS analyzer config (#627) | `0c4a81f` |
| `74361e89` | fix(okf): extract per-file parse loop, add crypto fallback, guard path parsing | `267ef00` |
| `f66742d7` | test(okf): extract shared StubFileReader helper, dedupe import tests | `8fdeece` |
| `9fa02a71` | fix(okf): use crypto.getRandomValues fallback instead of Math.random | `fa271d9` |
| `c2fe38f3` | refactor(export): extract shared LibraryPayload interface | `3c940be` |
| `918e80bc` | test(e2e): improve command palette test robustness | `223beca` |
| `400c7324` | fix(okf): guard crypto.getRandomValues in uuid fallback | `a72f617` |
| `90c56890` | fix(export): surface partial OKF import errors via warning toast | `68a9690` |
| `b5b947c6` | fix(okf): clean up commit history and refine trust helpers | `47a92c1` |
| `bc53bd94` | fix(quality): resolve all 28 repo-level Codacy issues (#628) | `98aaea4` |
| `00227c13` | test(e2e): wait for hydration before command palette interactions | `612d09f` |
| `2bab596f` | fix(a11y): darken sage token for AA contrast | `bf15101` |
| `ebecdd0b` | fix(okf): validate okf_version on bundle import | `5abfe60` |
| `6a9baf68` | fix(export): add unicode flag to truncation-assertion regex | `2ea6d34` |
| `4b6c3975` | perf(graph): memoize visible nodes, edges, and node map in GraphView (#772) | `4cf676c` |
| `5de1f4a5` | fix(security): sanitize sourceUrl and escape type fields in exports (#778) | `bee78c8`, `7733a1d`, `1f65ab5` |
| `3787e337` | feat(studio): implement open issues N1–N7 (#773) | `728fcf8`, `4406be8`, `1a68ac5`, `8acd0fd4`, `c496a222` |
| `d0fc0c63` | feat(studio): wire contextual right-panel close controls (#806) | `ba6c3b8` |
| `646682a7` | perf(studio): optimize hasExtractableClaims short-circuit (#807) | `47e9a24` |
| `f8f3cb34` | fix(studio): make refused-hydration recovery visible and fail closed (#842) | `c3c7e31` |
| `c6784a67` | fix: restore the plan-160 P1 batch reverted by the #890 squash (#893) | `378cde8` |
| `ab26b78d` | feat(ai-harness): add request timeout and Stop button (#923) | `d415e9b` |
| `35501688` | fix(deps): bump actions/setup-node from 7.0.0 to 7.1.0 (#963) | `e359c79` |
| `086b81e9` | fix(deps): bump actions/upload-artifact from 7.0.1 to 7.0.2 (#962) | `72fe335` |
| `0697310b` | fix(deps): bump reviewdog/action-actionlint from 1.77.0 to 1.80.1 (#961) | `4fb1d0d`, `3cd1823` |
| `ce9f16f8` | fix(deps-dev): bump @types/node from 26.6.3 to 26.6.5 (#960) | `94512ef` |
| `ac39506c` | fix(deps-dev): bump jsdom from 29.1.1 to 30.1.2 (#959) | `8452c1b` |
| `146adc75` | fix(deps): bump @radix-ui/react-separator from 1.1.15 to 1.2.0 (#958) | `2a058ff` |
| `0dd90a5b` | fix(deps): bump docx from 9.7.1 to 9.10.0 (#957) | `fb7f12a` |
| `5c62714a` | fix(deps): bump @radix-ui/react-hover-card from 1.1.23 to 1.2.1 (#995) | `4d222fb` |

Three do not map, and each for a stated reason:

| SHA | Finding |
| --- | --- |
| `6142cfeb` | GitHub answers "No commit found for SHA": it was never pushed, so the record cites a local commit |
| `ff98106e4c7b2bc287b24eaf42907196329070c7` | same: no such object on the remote |
| `1af799d` | exists remotely by message ("restore reviewed fixes … reverted by stale concurrent push"), but its work was superseded before a squash could carry it — there is nothing to point at |

The mapping is recorded here rather than edited into the 16 archive records:
those rows describe what a person did on a branch, and replacing the SHA would
rewrite the history of the work rather than explain it.

## Wave 2 — register 029–038

Nine records were missing from the register even though the index cites several
of them in plan rows. Added with the status each record states:

| ADR | Scope | Status |
| --- | --- | --- |
| 029 | Manifest-driven agent harness and skill validation (2026-07-19) | Implemented |
| 030 | GitHub branch protection for `main` (2026-08-01) | Implemented |
| 031 | Native OKF v0.2 bundle export and import | Implemented |
| 032 | BM25 reference cache for local search | Implemented |
| 033 | Markdown preview e2e verification | Implemented |
| 035 | Global error handling and client-side logging | Implemented |
| 036 | E2E responsive test matrix and pyramid integrity | Partially implemented |
| 037 | URL-addressable view state | Implemented |
| 038 | Cross-tab sync session tombstones (2026-09-08) | Implemented (session-scoped) |

031–033 and 035–037 carry no date line; their dates come from the commit that
added each file, and the cell says "recorded" rather than implying a decision
date. 039 has no record, so the register legitimately skips it.

The status parser gained a third form: 031, 032, 033, 035, 036 and 037 state the
status as a `## Status` section rather than a `**Status**:` line or a bullet, so a
guard that read only the latter two would have called six registered records
statusless.

With 029–057 registered, `ADR_REGISTER_FLOOR` drops from 58 to 29: every decision
record from 029 onward must now carry a row, and only the pre-register era
(001–028, whose rows live in the older reconciliation section and the table above
it) stays outside the guard.

## Wave 3 — #1204 triage

The issue asks for an exploratory, opt-in Ladybird compatibility assessment. Its
premises hold, with three corrections worth recording:

| Premise | Checked state (Ladybird alpha, 2026-11-23) |
| --- | --- |
| "early WebDriver implementation" | Shipped and documented; the browser's own release post advertises WebDriver plus the Firefox DevTools protocol, and WebDriver BiDi landed in October 2026 |
| "IndexedDB is architecturally small work" | Implemented, and moved to Rust in the October port |
| Service workers fine | Incomplete: a WASM-heavy app fails on `navigator.serviceWorker.startMessages`. Our offline cache does not call it, but the shell's service-worker paths are a real risk area |
| WebRTC for sync | A `WebRTCClient` process ships, but nothing here has measured data-channel behaviour; treat sync as out of scope for a first pass |

Decision: kept open, labelled `testing` and `priority: low`, with the evidence and
a narrowed first-pass scope in the issue thread. It is not a CI gate, not a support
promise, and not a release blocker while Ladybird is alpha — which is what the
issue already says, now backed by the documentation rather than assumed.

## Checks run

- `pnpm run docs:check` (register rows, statuses, plan links).
- Injection: changed ADR 036's register status to "Implemented" → the check fails
  on the "partially" vs "implemented" mismatch.
- `pnpm run lint`, markdownlint on every changed Markdown file.
