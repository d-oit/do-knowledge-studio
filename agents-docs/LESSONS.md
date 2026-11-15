# Lessons Learned

Index of technical discoveries, debugging resolutions, and process
improvements. Each lesson is one line below; the full write-up lives in
`agents-docs/lessons/NNN-slug.md`. For the machine-readable index, see
`lessons.jsonl` — `scripts/check-doc-consistency.mjs` enforces that the
index, the lesson files, and `lessons.jsonl` carry the same id set, and
that this file stays under 400 lines.

> Old `#LESSON-NNN` anchors (e.g. in plans/098) now live in the per-lesson
> files: `agents-docs/lessons/030-*.md#lesson-030`.

## Format

New lessons are one markdown file in `agents-docs/lessons/` plus one index
line here plus one `lessons.jsonl` row (same id in all three):

- Sequential numbering (LESSON-001, LESSON-002, etc.), Date and Component.
- Issue/Symptoms/Root Cause/Solution/Prevention structure.
- Distilled insight: 1–3 lines in the nearest `AGENTS.md`.
- Reference a lesson as `@agents-docs/lessons/NNN-slug.md`.

## Index

- [LESSON-001: Bash Exit Code 2 - Misuse of Shell Builtins in CI](lessons/001-bash-exit-code-2-misuse-of-shell-builtins-in-ci.md) — Quality Gate CI job fails with exit code 2 in GitHub Actions while passing locally.
- [LESSON-002: AGENTS.md Line Limit Violation - Progressive Disclosure Principle](lessons/002-agents-md-line-limit-violation-progressive-disclosure-princi.md) — AGENTS.md grew to 278 lines, exceeding the 150-line target for progressive disclosure.
- [LESSON-062: ESLint v9 + Vite 8 Rolldown Migration (2026-04-30)](lessons/062-eslint-v9-vite-8-rolldown-migration-2026-04-30.md) — Project used deprecated ESLint v8 config (`.eslintrc.cjs`), Vite 8 `manualChunks` (Rollup API), and `happy-dom` for Vitest.
- [LESSON-003: Skill Malformed JSON - Invalid evals.json Syntax](lessons/003-skill-malformed-json-invalid-evals-json-syntax.md) — `skill-creator/evals/evals.json` contains malformed JSON that breaks skill evaluation.
- [LESSON-004: Atomic Commit Workflow Zero Test Coverage](lessons/004-atomic-commit-workflow-zero-test-coverage.md) — The entire atomic commit workflow (2,835 lines across 8 scripts) has ZERO test coverage.
- [LESSON-005: GitHub Actions SKIP_TESTS - Tests Disabled in CI](lessons/005-github-actions-skip-tests-tests-disabled-in-ci.md) — CI workflow explicitly disables all testing with `SKIP_TESTS=true`.
- [LESSON-006: Skill Evaluation Gaps - Insufficient Edge Case Coverage](lessons/006-skill-evaluation-gaps-insufficient-edge-case-coverage.md) — 80% of skills (24 of 30) lack comprehensive edge case evaluations.
- [LESSON-007: Atomic Commit Missing Timeout - Network Operation Hangs](lessons/007-atomic-commit-missing-timeout-network-operation-hangs.md) — Git push retry loop in atomic commit workflow has no timeout; can hang indefinitely.
- [LESSON-008: Agent Override Inconsistency - CLAUDE.md vs GEMINI.md](lessons/008-agent-override-inconsistency-claude-md-vs-gemini-md.md) — Agent-specific override files have inconsistent content depth and purpose.
- [LESSON-009: Documentation Sync Duplication - Frontmatter Parsing Logic](lessons/009-documentation-sync-duplication-frontmatter-parsing-logic.md) — `update-agents-md.sh` and `update-agents-registry.sh` implement similar frontmatter parsing logic independently.
- [LESSON-010: Git Worktree Cleanup and Registration](lessons/010-git-worktree-cleanup-and-registration.md) — Scripts creating git worktrees leave orphaned directories and administrative data if they crash or are interrupted.
- [LESSON-011: CI Reliability - Why Validation Scripts Need `set +e`](lessons/011-ci-reliability-why-validation-scripts-need-set-e.md) — Validation scripts (like `validate-skills.sh`) exit prematurely on the first minor failure, preventing a full report of all issues.
- [LESSON-012: Bash Variable Scope - The `temp_table` Issue](lessons/012-bash-variable-scope-the-temp-table-issue.md) — Using generic variable names like `temp_table` in scripts causes collisions and unexpected behavior when scripts are sourced or have complex trap logic.
- [LESSON-013: CI Hangs Indefinitely Due to BATS Recursion](lessons/013-ci-hangs-indefinitely-due-to-bats-recursion.md) — Quality Gate job in GitHub Actions hangs for 15+ minutes, never completes, eventually times out after 6 hours.
- [LESSON-014: Shellcheck Warnings vs Errors in CI](lessons/014-shellcheck-warnings-vs-errors-in-ci.md) — Shellcheck fails CI build on style warnings (SC2155, SC2034), blocking merges for non-functional issues.
- [LESSON-015: GitHub API 403 Errors in Generic Templates](lessons/015-github-api-403-errors-in-generic-templates.md) — CI job fails with "HTTP 403: Resource not accessible by integration" when calling GitHub API.
- [LESSON-016: Dependency Synchronization during Major Upgrades (Vite 8)](lessons/016-dependency-synchronization-during-major-upgrades-vite-8.md) — Upgrading Vite to major version 8 causes peer dependency conflicts and build failures if companion plugins and test runners are not updated in sync.
- [LESSON-022: Codacy Cloud CLI for PR issue suppression](lessons/022-codacy-cloud-cli-for-pr-issue-suppression.md) — Codacy Static Code Analysis check blocks PRs with ACTION_REQUIRED status
- [LESSON-023: Codacy Analysis CLI local limitations](lessons/023-codacy-analysis-cli-local-limitations.md) — Running `codacy-analysis analyze` locally shows "0 issues" even though Codacy Cloud reports 86+ issues.
- [LESSON-024: gitleaks-action v3 requires a paid license](lessons/024-gitleaks-action-v3-requires-a-paid-license.md) — `Security Scan` workflow failed on every PR with
- [LESSON-025: yamllint lints block scalars and templates](lessons/025-yamllint-lints-block-scalars-and-templates.md) — `YAML Syntax Validation` CI failed on workflow changes that
- [LESSON-026: Bot review threads block merges even when checks pass](lessons/026-bot-review-threads-block-merges-even-when-checks-pass.md) — PRs showed `BLOCKED` with all checks green; the branch rule
- [LESSON-027: New module-scope helpers trigger DeepSource JS-0067 and JS-R1005](lessons/027-new-module-scope-helpers-trigger-deepsource-js-0067-and-js-r.md) — PR #647 (BM25 cache refactor) failed the `DeepSource:
- [LESSON-028: BLOCKED merge state with all-green checks may hide in-flight runs](lessons/028-blocked-merge-state-with-all-green-checks-may-hide-in-flight.md) — PR #652 showed `mergeStateStatus: BLOCKED` while `gh pr checks`
- [LESSON-029: GitHub ubuntu-latest runners do not ship bats-core](lessons/029-github-ubuntu-latest-runners-do-not-ship-bats-core.md) — The diagnoser BATS suite (tests/) passed 12/12 locally but had
- [LESSON-030: Check pullRequest.reviewThreads before declaring merge-state staleness](lessons/030-check-pullrequest-reviewthreads-before-declaring-merge-state.md) — PR #670 sat `BLOCKED` for 1.5+ hours with every check green
- [LESSON-031: Codacy required check can go MISSING on a head (transient delay)](lessons/031-codacy-required-check-can-go-missing-on-a-head-transient-del.md) — PR #678 sat `BLOCKED` with every check green and `Codacy Static
- [LESSON-032: Outdated review threads still block merges; keep skill scripts on a shared lib](lessons/032-outdated-review-threads-still-block-merges-keep-skill-script.md) — PR #692 sat `BLOCKED` with all 26 checks green (including the
- [LESSON-033: Absolute Overlay Clear Button Clearance and Native Config Deprecation Forward-Compat](lessons/033-absolute-overlay-clear-button-clearance-and-native-config-de.md) — When adding an absolute-positioned clear button inside an input, text clipping can occur if right padding matches button width alone rather than total extent...
- [LESSON-034: Codacy and DeepSource re-post stale findings as NEW blocking threads](lessons/034-codacy-and-deepsource-re-post-stale-findings-as-new-blocking.md) — A PR with all checks green stays blocked because Codacy or
- [LESSON-035: A `--changed` gate can silently check nothing if it guesses its own base](lessons/035-a-changed-gate-can-silently-check-nothing-if-it-guesses-its.md) — `quality_gate.sh --changed` (the CI Quality Gate job) derived its
- [LESSON-037: Autosave plus a validating schema silently discards every](lessons/037-autosave-plus-a-validating-schema-silently-discards-every.md) — The AI Harness settings panel autosaves on every state
- [LESSON-038: Verify a vendor integration against the vendor's own docs, not the plan that proposed it](lessons/038-verify-a-vendor-integration-against-the-vendor-s-own-docs-no.md) — A Jev (TypeSafe) chat-provider adapter was built, reviewed,
- [LESSON-039: Name the tool from Codacy's own API, not from the `nosemgrep` comment](lessons/039-name-the-tool-from-codacy-s-own-api-not-from-the-nosemgrep-c.md) — A Codacy SSRF finding survived six inline-suppression
- [LESSON-040: Grep for an existing helper before adding one — duplicate escaping broke a passing BATS test](lessons/040-grep-for-an-existing-helper-before-adding-one-duplicate-esca.md) — A supposedly broken markdown table row in a generated skills catalog
- [LESSON-041: A slice default can silently shadow the seed — verify the composition order, not just the pieces](lessons/041-a-slice-default-can-silently-shadow-the-seed-verify-the-comp.md) — After decomposing `store.ts` into slices, the chat transcript was
- [LESSON-042: A symlinked `node_modules` is staged by `git add -A`, and `HUSKY=0` does not bypass `.githooks`](lessons/042-a-symlinked-node-modules-is-staged-by-git-add-a-and-husky-0.md) — A PR branch shipped a `node_modules` symlink (mode `120000`) in its
- [LESSON-043: A pushed head can be built on a stale base and silently revert `main` — bless it before you merge](lessons/043-a-pushed-head-can-be-built-on-a-stale-base-and-silently-reve.md) — A PR's head commit was re-pushed by an automation run whose tree had
- [LESSON-044: Dependency ranges can move backwards in a merge — `git log -S` proves the direction](lessons/044-dependency-ranges-can-move-backwards-in-a-merge-git-log-s-pr.md) — `main` shipped for two days with four dependencies **downgraded**:
- [LESSON-045: `AbortSignal.any` fallbacks and bare `stop` identifiers are invisible to the type checker](lessons/045-abortsignal-any-fallbacks-and-bare-stop-identifiers-are-invi.md) — Two defects in the same feature survived a green unit suite and a
- [LESSON-046: A lint config in the wrong format is not a config — and its `--fix` can rewrite prose into headings](lessons/046-a-lint-config-in-the-wrong-format-is-not-a-config-and-its-fi.md) — markdownlint reported thousands of findings on a repo that had a config file, because the rules sat under an unread `[tool.markdownlint]` table
- [LESSON-047: A wrapper's "config" argument may only be a cache key — verify what the command receives](lessons/047-a-wrapper-s-config-argument-may-only-be-a-cache-key-verify-w.md) — quality_gate.sh passed the markdownlint config as only a cache key, so the gate linted with stock rules
- [LESSON-048: `|| true` on a command whose empty output means "take the risky path" is fail-open](lessons/048-true-on-a-command-whose-empty-output-means-take-the-risky-pa.md) — The Vercel skip script computed its changed-file list with
- [LESSON-049: The Vercel Hobby deployment cap is owner-scoped, and production shares it with previews](lessons/049-the-vercel-hobby-deployment-cap-is-owner-scoped-and-producti.md) — 100 deployments per 24 h, owner-scoped; production and previews share one budget
- [LESSON-050: A dispatch on `main` cancels the push CI on `main`, and vice versa](lessons/050-a-dispatch-on-main-cancels-the-push-ci-on-main-and-vice-vers.md) — `ci-and-labels.yml` (workflow name "CI") runs on both `push` and
- [LESSON-051: Job logs come back as a ZIP from the raw API — grep reads binary](lessons/051-job-logs-come-back-as-a-zip-from-the-raw-api-grep-reads-bina.md) — `gh api repos/{owner}/{repo}/actions/jobs/{id}/logs` returns a redirect to a
- [LESSON-052: A fix that makes the failing test pass can still break a shared resource](lessons/052-a-fix-that-makes-the-failing-test-pass-can-still-break-a-sha.md) — The failing test is evidence about **one** symptom
- [LESSON-053: GitHub's squash message comes from the PR's FIRST commit, not the final state](lessons/053-github-s-squash-message-comes-from-the-pr-s-first-commit-not.md) — `gh pr merge --squash` builds the commit message from the **PR title and the
- [LESSON-054: A job can stay `in_progress` forever while its run concluded `success`](lessons/054-a-job-can-stay-in-progress-forever-while-its-run-concluded-s.md) — Both `gh pr checks` and `commits/{sha}/check-runs` can report a job as
- [LESSON-055: A documented "finding" is a hypothesis until a command proves it](lessons/055-a-documented-finding-is-a-hypothesis-until-a-command-proves.md) — `plans/perf-baselines.md` recorded, as a finding, that the repository's
- [LESSON-056: Codacy reads angle brackets in CLI usage text as HTML](lessons/056-codacy-reads-angle-brackets-in-cli-usage-text-as-html.md) — A new Node CLI script failed the Codacy gate with a security issue:
- [LESSON-057: `page.evaluate` bypasses CSP, so an in-page eval probe proves nothing](lessons/057-page-evaluate-bypasses-csp-so-an-in-page-eval-probe-proves-n.md) — Verifying that production CSP no longer allows `'unsafe-eval'`, an
- [LESSON-058: `'wasm-unsafe-eval'` is not `'unsafe-eval'`, and booting the app never tells you which you needed](lessons/058-wasm-unsafe-eval-is-not-unsafe-eval-and-booting-the-app-neve.md) — `'unsafe-eval'` was removed from the production `script-src` on the
- [LESSON-059: Cross-origin model assets must be routed by host, not by extension](lessons/059-cross-origin-model-assets-must-be-routed-by-host-not-by-exte.md) — Adding offline caching for the embedding model, the obvious fix was
- [LESSON-060: A cache write inside the fetch's `try` block reports a storage rejection as a network outage](lessons/060-a-cache-write-inside-the-fetch-s-try-block-reports-a-storage.md) — Semantic search reported "Service unavailable" for the model's
- [LESSON-061: A service worker needs a driving test, not a text assertion](lessons/061-a-service-worker-needs-a-driving-test-not-a-text-assertion.md) — `pwa-service-worker.test.ts` was green for the whole round in which
- [LESSON-063: Codacy `security_detect-non-literal-fs-filename` is syntactic — validated paths still flag](lessons/063-codacy-non-literal-filename-is-syntactic-validation-ignored.md) — Eight findings on dev scripts survived a genuine code fix (NUL/extension/containment validation) and re-fired at the validated lines: the rule fires on any non-literal `fs` argument, so triage the residual per-finding in the UI instead of restructuring code or suppressing config.
