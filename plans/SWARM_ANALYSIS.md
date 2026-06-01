# Swarm Analysis: Missing Implementations & Repository Health

> Generated 2026-06-01 via parallel agent swarm with handoff coordination

## Participating Agents

| Agent | Focus Area |
|-------|------------|
| Agent 1 | GitHub Actions workflow audit |
| Agent 2 | Open PRs, issues, and GitHub state |
| Agent 3 | Codebase missing implementations & technical debt |
| Agent 4 | Build, test, and quality health |

---

## Critical Findings (Consensus: Multiple Agents Agree)

### 1. XSS Vulnerability in Export — CONFIRMED by Agent 3 + Issue #238

Entity descriptions are injected raw into HTML export without `escapeHtml()`:
- `src/features/export/ExportPanel.tsx:170` — no escaping on `entity.description`
- `cli/index.ts:161-163` — same pattern in CLI export

**Status:** Issue #238 exists but is tagged `[Security] Encrypt API keys at rest and fix SSRF` — the XSS in export descriptions may be a separate untracked bug.

### 2. Incomplete Search Navigation — CONFIRMED by Agent 3 + Issue #227

`handleSearchResultClick` in `src/app/App.tsx:83-90` navigates to editor but doesn't select/scroll to the matched entity. The comment acknowledges this is unfinished.

**Related open issue:** #227 "Wire Chat component to LLM providers" (PR #245 addresses this)

### 3. Dead `library` View — CONFIRMED by Agent 3

`SidebarNav` defines a `'library'` navigation item, but the `View` type in `App.tsx` doesn't include it. No component renders for this view. This is a dead UI element.

### 4. `as any` Type Escapes — CONFIRMED by Agent 3 + Agent 4

Two instances in `src/db/repository.ts:119,297`:
```ts
return { ...parsed, rowid: (rows[0] as any).rowid };
```
These violate the project's `strict: true` TypeScript config and ESLint's `@typescript-eslint/no-explicit-any: 'error'` rule. The rest of the file correctly uses `as unknown`.

---

## Open PRs (3)

| PR | Title | Status | Labels |
|----|-------|--------|--------|
| #247 | Modularize Oversized Files and Implement Repository Injection | Open, CI passing | config, tests, skills |
| #246 | Expand test coverage for core features | Open, CI passing | config, tests |
| #245 | Wire Chat component to LLM providers | Open, CI passing | config, tests |

All 3 PRs are passing CI. No review decision yet. They address issues #226, #228, and #227 respectively.

---

## Open Issues (17)

### Bugs (High Priority)

| Issue | Title | Labels |
|-------|-------|--------|
| #240 | Add Zod validation for graph snapshot loading | bug, duplicate, priority: high |
| #239 | Fix browser migration fallback loading only first file | bug, duplicate, priority: high |

### Security (High Priority)

| Issue | Title | Labels |
|-------|-------|--------|
| #238 | Encrypt API keys at rest and fix SSRF | security, priority: high |

### Documentation (High Priority)

| Issue | Title | Labels |
|-------|-------|--------|
| #237 | Create comprehensive documentation suite | documentation, priority: high |

### Features (All High Priority, Most Tagged Duplicate)

| Issue | Title | Labels |
|-------|-------|--------|
| #236 | Improve static export to multi-page site | feature, duplicate |
| #235 | Add entity version history | feature, duplicate |
| #234 | Add tags / categories system | feature, duplicate |
| #233 | Add import functionality (markdown, JSON, OPML) | feature, duplicate |
| #232 | Add graph filtering and node search | feature, duplicate |
| #231 | Add undo/redo across editor, graph, and mind map | feature, duplicate |
| #230 | Expand editor toolbar with formatting options | feature, duplicate |
| #229 | Expand E2E tests for critical user journeys | tests, duplicate |
| #228 | Add comprehensive unit tests for mind map, CLI, and graph | tests, duplicate, jules |
| #227 | Wire Chat component to LLM providers | feature, duplicate, jules |
| #226 | Split 4 oversized files (repository, GraphView, AIHarness, search) | refactor, jules |

**Note:** Issues #226-#236 are all marked `duplicate`. The dedup workflow (`dedup-issues.yml`) uses a flawed similarity algorithm (character match ratio, not Levenshtein distance) which may be incorrectly labeling issues.

---

## GitHub Actions Issues (20 Found)

### Critical (4)

1. **`dependabot-auto-merge.yml`** — Polling anti-pattern (30 min timeout), uses `getCombinedStatusForRef` which misses check runs, could merge broken PRs
2. **`create-jules-issues.yml`** — Non-idempotent issue creation, duplicates on every push
3. **`dependabot-auto-merge.yml`** — Auto-merges ALL dependabot PRs including major version bumps
4. **`dependabot-auto-merge.yml`** — Triggers on ALL PRs, not just dependabot

### Significant (8)

- `ci-and-labels.yml` — Duplicate dependency installation across jobs, no job timeouts
- `dedup-issues.yml` — Misnamed "levenshteinRatio" is actually character match ratio
- `cleanup.yml` — Fragile quality gate logic with `continue-on-error`
- `version-propagation.yml` — Push race condition, token in URL
- `stale.yml` — Excessive `contents: write` permission

### Minor (8)

- Missing concurrency groups on most workflows
- `security-scan.yml` — Duplicate shellcheck invocations
- `yaml-lint.yml` — Redundant path patterns
- `sync-turso-skill.yml` — No error handling on curl

---

## Missing Implementations in Code

### High Severity

| Location | Issue |
|----------|-------|
| `src/app/App.tsx:83-90` | Search result click doesn't navigate to specific entity |
| `src/components/SidebarNav.tsx:30-34` | `library` view is a dead navigation item |
| `src/features/export/ExportPanel.tsx:170` | XSS: entity descriptions not escaped in export |
| `cli/index.ts:161-163` | Same XSS in CLI export |

### Medium Severity

| Location | Issue |
|----------|-------|
| `src/db/repository.ts:119,297` | `as any` type escapes violating strict config |
| `src/features/chat/Chat.tsx:38` | `limit: 5` option silently ignored by `searchKnowledge` |
| `src/db/repository.ts` (12 methods) | Inconsistent error re-wrapping (double-wraps AppError) |
| `src/lib/search.ts:546` | Silent catch in progressive search related-entity stage |

### Low Severity

| Location | Issue |
|----------|-------|
| `src/features/mindmap/MindMapView.tsx:64` | Unused `relatedEntities` prop |
| `src/features/ai/AIHarness.tsx:136` | Deprecated `onKeyPress` (should be `onKeyDown`) |
| `cli/index.ts:206` | `Claim` type used but not imported |
| `src/lib/search.ts:43-57` | `initEmbeddings()` JSDoc is misleading (says downloads model, actually doesn't) |

---

## Dependency Concerns

| Package | Issue | Severity |
|---------|-------|----------|
| `sigma: ^3.0.0-beta.27` | Beta dependency in production | Medium |
| `eslint: ^8.57.0` + `typescript-eslint: ^8.59.3` | Version mismatch (v8 eslint with v9-era typescript-eslint) | Low |
| Coverage thresholds | 14% branches, 16% functions — very conservative baseline | Info |

---

## CI/CD Health

**Recent runs:** All passing (last 20 runs show `success` or `skipped`)

**Current pipeline:**
- CI (typecheck + lint + test + build): passing
- Security Scan: passing
- Commit Lint: passing
- Dependabot Auto-Merge: skipped (expected for non-dependabot PRs)
- PR Labeler: passing

---

## Recommended Priority Actions

### P0 — Fix Now
1. **Fix XSS in export** — Escape entity descriptions in `ExportPanel.tsx` and `cli/index.ts`
2. **Fix `as any` in repository.ts** — Change to `as unknown as { rowid: number }` or add `rowid` to Zod schema
3. **Fix dependabot auto-merge** — Replace polling with `gh pr merge --auto`, add update-type filtering

### P1 — Address Soon
4. **Merge open PRs** (#245, #246, #247) — All passing CI, address issues #226-#228
5. **Add concurrency groups** to CI workflows to avoid wasted runner minutes
6. **Fix dedup similarity algorithm** — Replace character match with actual edit distance
7. **Remove dead `library` view** from SidebarNav or implement it

### P2 — Backlog
8. **Add job timeouts** to CI and E2E workflows
9. **Fix version-propagation race condition** with concurrency group
10. **Reduce stale.yml permissions** (remove `contents: write`)
11. **Address silent error swallowing** in repository.ts methods
12. **Clean up deprecated `onKeyPress`** in AIHarness.tsx
