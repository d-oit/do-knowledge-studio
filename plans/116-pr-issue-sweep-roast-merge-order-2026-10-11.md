# Plan 116 — Open-PR / open-issue sweep, roast, and merge order (2026-10-11)

## 1. Inventory (GitHub API, unauthenticated, 2026-10-11)

**Open PRs: 9.** `mergeable` / `mergeable_state` from the API at sweep time.

| PR | Title | Files | Mergeable | State | Fixes |
|----|-------|-------|-----------|-------|-------|
| #910 | refactor(ux): extract shared EntitySearchPanel | 5 (+510/−357) | **false / dirty** | unstable | #864 |
| #920 | feat(ux): tooltip title on right-panel close button | 2 (+12/−2) | true | unstable | — |
| #922 | fix(deps): sharp 0.35.4 → 0.35.5 (dependabot) | 2 (lockfile) | true | unstable | alert #76 |
| #923 | feat(ai-harness): request timeout + Stop button | 7 (+126/−20) | true | unstable | #885 |
| #924 | fix(deps): source-map-js override → ^1.2.2 | 2 | true | unstable | alert #75 |
| #925 | fix(pwa,a11y,deps): Plan 161/162 batch | 38 (+2658/−150) | true | unstable | — |
| #926 | fix(a11y): announce completed AI responses, not tokens | 2 (+44/−1) | true | unstable | #887 |
| #927 | fix(ai): map raw provider errors to friendly copy | 4 (+68/−6) | true | unstable | #884 |
| #928 | fix(ai-harness): stable IDs for chat messages | 5 (+48/−7) | true | unstable | #883 |

**Pure open issues: 19** (28 open issue+PR minus 9 PRs). Five are covered by the PRs above
(#883→#928, #884→#927, #885→#923, #887→#926, #864→#910). The other 14 were
re-verified against current `main` (68d4398) with targeted greps — **all still reproduce**:

#886 (model defaults drift), #873 (no system theme), #870 (view-chrome patchwork),
#867 (drawer tablist), #865 (hardcoded nav labels), #863 (destructive actions w/o confirm),
#862 (mobile touch targets), #861 (table `role="link"`), #858 (`@layer` utilities),
#856 (editor status-bar live region), #855 (245 `text-[Npx]` bypasses), #853 (hex twins
in `sync/cursors.ts` + `sync/presence.ts`), #852 (162 `44px` copies), #851 (entity
palette renders raw Tailwind).

## 2. Roast

- **#920** — a 12-line tooltip PR wearing a 🔴 CRITICAL blast-radius badge that
  reaches "five dependents". The badge is graph-theater: the change is a `title`
  attribute. Harmless, correct, merge it first and stop paying CI for it.
- **#910** — the only dirty PR. Real refactor, real tests, but it sat while #911
  (`Intl` format module) landed on the same `right-panel.tsx` hunks. Lesson: big
  refactors that touch chrome files rot fast; rebase or die.
- **#923/#926/#927/#928** — four Jules PRs nibbling the same two files
  (`ai-harness-chat.tsx`, `use-ai-harness-chat.ts`). Each is individually sane;
  together they are a merge-queue traffic jam nobody scheduled. They MUST land in
  dependency order (§5) with a rebase between each, or the later ones will
  re-resolve the same conflicts by hand.
- **#926** — ships a hardcoded `'Response complete'` string while the repo has a
  19-module i18n system and an `announce.ts` message module built for exactly this.
  AGENTS.md hard rule ("never hardcode user-facing strings") violated in an a11y
  PR of all places. Fix before merge (one-line + test).
- **#928** — `id?: string` optional with an `index-role` fallback key. The fallback
  reintroduces the collision class the PR claims to kill (duplicate content at
  different indices is fine; the *initial* message + duplicates still collide by
  construction if `id` is ever absent). Pragmatic, not wrong — making `id`
  required would touch chat-slice/seed/hydration — but the PR description
  oversells it.
- **#925** — 38 files, +2658 lines, PWA precache + recovery + React 19.3 + a11y +
  deps + docs in one trench coat, and Codacy says **3 HIGH**. This is the exact
  "keep changes scoped" violation the repo rules exist to prevent. Do not merge
  until the HIGHs are zero; consider splitting the React bump out.
- **#924** — the good kind of boring: one override line that unblocks two red
  checks. Model citizen.
- **#922** — dependabot doing dependabot things. Fine.
- **Issues #851–#858** — the design-token quartet + friends have sat since 10-01
  with zero comments. They are real (245 `text-[Npx]` bypasses counted today) but
  each is a migration, not a fix — they need owners, not more description.

## 3. Close verdicts

**Nothing closed.** Every open PR changes behavior, fixes an alert, or carries
tests; every open issue reproduces on current `main`. Closing any of them would
be tidiness theater. (The closest candidate, #920, is a genuine — if tiny —
a11y improvement: keep.)

## 4. Implemented in this plan (branch `freebuff/529fc59dbc13bb627df6d75e`)

Two missing-task issues, chosen for zero file-overlap with all 9 open PR branches
(verified per-branch; only #925 touches the same `e2e/accessibility.spec.ts`, in a
non-overlapping hunk that auto-merges):

- **#861 — library table rows used `role="link"`**: rows now expose native table
  semantics; the open action is a real `<button aria-label="Open X">` in the name
  cell (same pattern the grid cards already use). Row click stays as a mouse
  affordance; double-`startEdit` prevented via `stopPropagation`.
  Files: `library-entities.tsx`, `library-entities.test.tsx`,
  `library-view.test.tsx`, `e2e/library-virtualization.spec.ts`,
  `e2e/accessibility.spec.ts`.
- **#873 — system theme option**: `enableSystem` + `defaultTheme="system"`
  (stored user choices win; new users follow the OS), new sidebar System button
  (`Monitor` icon, `aria-pressed`), toggle now reflects the *resolved* scheme,
  labels extracted to `SIDEBAR_THEME_LABELS`, stale `enableSystem={false}`
  comment in `layout.tsx` corrected.
  Files: `theme-provider.tsx`, `sidebar.tsx`, `theme-provider.test.tsx`,
  `sidebar.test.tsx`, `layout.tsx`, plus `Monitor` added to the
  `announcer-integration.test.tsx` lucide mock (new icon broke it — caught by tests).

Verification: `eslint .` clean (zero warnings), `tsc --noEmit` clean,
**full unit suite 2838 passed / 1 skipped / 0 failed across 185 files**
(single-worker; the 4 GB sandbox OOMs on the default pool — use `--maxWorkers=1`
here). e2e not runnable in this environment (no Playwright browsers installed);
the two touched specs were updated and must run in CI. `next build` not run
(change is typechecked + unit-covered; CI builds).

## 5. Merge order (when each PR's comments are resolved and CI is green)

Constraints: #922+#924 both touch `package.json`/lockfile; #923/#926/#927/#928
all touch the AI-harness chat files; #910 is dirty; #925 has Codacy HIGHs.

1. **#922** (sharp) — smallest lockfile diff, no code.
2. **#924** (source-map-js override) — rebase onto #922 if the lockfile conflicts
   (both regenerate it); clears Dependabot alert #75.
3. **#920** (tooltip) — trivial, isolated, green Codacy. Get it off the board.
4. **#923** (timeout + Stop) — first of the harness stack; biggest harness diff,
   sets the base the others rebase onto. Fixes #885.
5. **#928** (stable IDs) — rebase onto #923, then merge. Fixes #883.
6. **#927** (error mapping) — rebase onto #928, then merge. Fixes #884.
   (Requires the `ai-harness-view-coverage` expectation update it already carries.)
7. **#926** (aria-live) — last of the harness stack; rebase onto #927, then merge.
   **Pre-merge fix required**: move `'Response complete'` into i18n
   (`messages/announce.ts`, e.g. `announce.aiResponseComplete`) — see followup §6.1.
   Fixes #887.
8. **#910** (EntitySearchPanel) — **rebase required first** (conflicts with #911 in
   `right-panel.tsx`); then merge. Fixes #864. Note: it also touches
   `mobile-drawer.tsx`, so it must land before any drawer-theme parity work (§6.3).
9. **#925** (Plan 161/162 batch) — last: widest blast radius, needs its 3 Codacy
   HIGHs at zero and a full e2e pass. Rebase onto everything above at the end.
10. **This branch (Plan 116: #861 + #873)** — independent of all nine; mergeable
    any time CI is green. Only caveat: same-file/different-hunk with #925 in
    `e2e/accessibility.spec.ts` — whoever merges second gets a clean auto-merge,
    but confirm the spec file still parses.

Do NOT merge with: Codacy `ACTION_REQUIRED`/`FAILED` on the PR (zero-tolerance
per AGENTS.md), unresolved review threads (including outdated ones), or a stale
`mergeable_state=dirty` (rebase, don't force-push over someone's branch without
asking — the Jules branches belong to their automation).

Standing authorization applies: when a PR is fully clean (all checks incl. Codacy
+e2e green, threads resolved, review pass done, local gate green), merge with
`gh pr merge <PR> --auto --squash --delete-branch` in the §5 order. This session
did **not** merge anything: see §7.

## 6. Followups (drafted — not filed: this environment has no GitHub write access)

### 6.1 PR #926 — hardcoded announcement string (comment for the PR author)
> `ai-harness-chat.tsx` renders a hardcoded `'Response complete'` status string.
> The repo has `src/lib/i18n/messages/announce.ts` for exactly this (AGENTS.md:
> never hardcode user-facing strings). Suggested: add
> `'announce.aiResponseComplete': 'Response complete'` and render
> `{lastTurnFinished ? translate(...) : ''}` with a unit test on the translated
> key. Blocking merge per repo hard rules.

### 6.2 PR #928 — optional `id` + index fallback (comment for the PR author)
> `ChatMessage.id` is optional with a `m.id ?? \`${index}-${m.role}\`` fallback.
> Fine incrementally, but the fallback preserves a collision class for id-less
> messages; consider `id: string` required as a follow-up (touches
> chat-slice/seed/hydration constructors — deliberately out of scope here).

### 6.3 New issue — mobile-drawer theme parity (file after #910 lands)
> Title: `[ux] Mobile drawer theme toggle has no System option`
> Body: Plan 116 added a System choice to the desktop sidebar (#873) but left
> `mobile-drawer.tsx` untouched (open PR #910 owns that file until it merges).
> After #910: add the same `setTheme('system')` pressed-state button using the
> existing `drawer.theme.*` i18n scope (`drawer.theme.system`,
> `drawer.theme.systemAria`), mirroring `Sidebar`.

### 6.4 Remaining 12 open issues need owners, not triage
#886, #870, #867, #865, #863, #862, #856, #855, #853, #852, #851, #858 are all
confirmed live. Suggested next slices: #863 (shared ConfirmDialog — blocks on
nothing), #867 (drawer tablist→group — after #910), #862 (touch targets —
pairs with #867 in the drawer).

## 7. What this session did NOT do (explicit limitations)

- **No PR/issue closed** — verdict: none qualify (§3), not lack of trying.
- **No merges** — correct order is §5, but merging requires `gh`/API write access
  plus green CI + resolved threads, none of which hold right now (all 9 PRs report
  `mergeable_state=unstable` with checks still in flight; #910 dirty; #925 Codacy
  HIGHs). Merging from here would violate the repo's own merge rules.
- **No GitHub issues filed** — no token in this environment (`gh` absent, API
  unauthenticated, `cloud_git` is fetch/pull/push only). Drafts are in §6 for the
  maintainer to paste.
- **No e2e run** — Playwright browsers are not installed in the sandbox; the two
  touched specs are updated and await CI.
