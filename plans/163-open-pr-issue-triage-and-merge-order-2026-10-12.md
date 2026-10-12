# Plan 163 — Open PR + issue triage, roast, and verified merge order (2026-10-12)

**Scope**: all 10 open PRs (#920, #922–#930) and all 18 open issues (#851–#886).
**Method**: every PR ref fetched and reviewed from its real diff; each PR's own test
files run locally; pairwise + sequential merge simulation; a full integration branch
(`integration/land-open-prs`) built, conflict-resolved, and gated.
**Hard blocker**: this environment has **no GitHub write credentials** — `GET /user`
returns 401, no `gh` CLI is installed, and the unauthenticated core rate limit (60/h)
was exhausted. **No PR was merged, no issue was closed, no issue was created, no
comment was posted.** §8 gives the exact commands for the maintainer.

## 0. TL;DR

- **9 of 10 PRs are green and landable**: #920, #922, #923, #924, #926, #927, #928,
  #929, #930. Verified by building the merge, not by reading the diffs.
- **#925 is red and must not be merged as-is** (§6): code-scanning reports *1 new
  high-severity alert*, Codacy reports *3 new issues (0 max.)*, on a 38-file /
  2,658-insertion PR that mixes four unrelated concerns.
- **No PR and no issue qualifies for "close as no-impact"** (§7). Every one of the 18
  issues was re-verified against the current tree and is still true. The 6 that the
  open PRs close are resolved *by* those PRs, not dead.
- **A live regression on `main` was found** (§5): PR #910 silently rolled back four
  dependency bumps (including `next`), which is why the `next` **HIGH** SSRF advisory,
  `sharp`, and `source-map-js` advisories are still firing on `main`.
- **4 real conflicts** exist between the green PRs (§3); all four were resolved and
  the integrated tree passes lint + typecheck. Two post-merge semantic defects that
  no individual PR could see were found and fixed (§4).
- **Merge order is pinned by two landmines**, not by preference (§3.3).

## 1. What was verified (and how)

| Check | How | Result |
|---|---|---|
| Per-PR CI conclusion | check-runs API, cached per PR | 9 green; #930 had 2 runs still in progress (Quality Gate, Unit Tests); #925 red |
| Per-PR correctness | `pnpm exec vitest run <that PR's test files>` on the PR ref | 920: 33 ✓ · 923: 61 ✓ · 926: 26 ✓ · 927: 23 ✓ · 928: 36 ✓ · 929: 54 ✓ · 930: 47 ✓ |
| Dep PRs | `pnpm install --frozen-lockfile` + resolved-version read | 922 → `sharp@0.35.5`; 924 → `source-map-js@1.2.2` (both exist on npm; `smj` override is what moves it) |
| Merge compatibility | `git merge-tree --write-tree` pairwise, then 9 real sequential merges | 4 conflicting pairs; all resolved |
| Integrated tree | `eslint .`, `tsc --noEmit`, `vitest run` | lint 0 · typecheck 0 · see §4 for the one failure found |
| Advisories | `pnpm audit` on both `main`'s and #925's package.json+lockfile pairs | `main`: next SSRF + sharp + source-map-js + braces (all HIGH). #925: same minus `next` |
| Issue validity | targeted greps against the working tree for each of the 18 claims | all 12 non-PR issues still reproducible (§7) |

Not run: `pnpm run test:e2e` (Playwright browsers are not installed here) and the
production-build offline suite. **Any claim about e2e or the Workers/browser surface is
out of scope of this pass.**

## 2. PR verdicts

| PR | Closes | Verdict | Roast — the part that matters |
|---|---|---|---|
| **#920** tooltip title | — | **merge** | Adds an optional `title` prop that *no call site passes* (4 call sites, all default). The shipped behaviour is `title={aria-label}` — a native hover tooltip on a control that already has a name. Real, tiny; the prop is speculative API surface. |
| **#922** sharp 0.35.5 | — | **merge** (low value) | Both edits are caret→caret (`^0.35.4` → `^0.35.5`) and `^0.35.4` *already admitted* 0.35.5 — the `package.json` change is cosmetic. The value is the lockfile pin, which does clear a real HIGH advisory (`sharp@<0.35.5`, librsvg CVE). Note `sharp` is imported by **nothing** in `src/`. |
| **#924** source-map-js | — | **merge** | Genuine fix: `main` resolves 1.2.1, the override forces 1.2.2 (`source-map-js@>=1.0.0 <1.2.2` DoS). Two blemishes: it also **reindents an unrelated `brace-expansion@>=5` line** (pure diff noise), and `.gitattributes` marks the lockfile `-diff`, so the reviewer cannot see a single byte of the change the PR actually ships (§9 F4). |
| **#930** drawer aria-pressed | #867 | **merge** | Correct conversion (`role="tablist"/tab` → `role="group"` + `aria-pressed`, `aria-selected` dropped). It leaves the "tab" vocabulary behind — component `TabSwitcher`, key `drawer.tabsAriaLabel` — so the code and the a11y tree disagree forever. Tests were updated honestly (they assert `queryByRole('tab')` is null, not just the happy path). |
| **#929** system theme | #873 | **merge** (conflicts with #930) | 9 files for one toggle, but justified: `theme-color` meta sync + a new i18n scope is more than a toggle. Roast: the drawer footer cycles light → dark → **system**, and the button's visible label is the *next* state, not the current one — the label reads backwards to the sighted user while the `aria-label` describes the next action. |
| **#928** stable message ids | #883 | **merge** | Adds `id?: string` and keys on `m.id ?? \`${index}-${role}\``. The `index` fallback **is the bug #883 filed** (key changes per token remount the streaming bubble); it is dead today only because the hook now always sets an id, i.e. the guard against regression is a comment (§9 F5). |
| **#926** announce completion | #887 | **merge** | `role="log"` + `aria-live="off"` + a `role="status"` region is the right shape. But `'Response complete'` is **hardcoded English** in a component that has i18n available — a direct AGENTS.md violation (§9 F2). The `prevLoadingRef` effect is a derived-value dance that a `usePrevious` ref or an effect-free reducer would avoid. |
| **#927** friendly provider errors | #884 | **merge** | Good: raw detail moves to `console.error`, users get copy. Roast: classification is **regex over provider prose** (`/error 401|Unauthorized/i`, `/error 429/`, `/Failed to fetch|NetworkError/i`); any provider copy change silently degrades every error to "unexpected" (§9 F3). `src/lib/i18n/messages/ai.ts` still has **no trailing newline** (pre-existing, preserved). |
| **#923** timeout + Stop | #885 | **merge, with 2 fixes** | Best material in the set — see §4. The timeout branch contradicts the two PRs merging next to it (hardcoded English where #927 added i18n; no `id` where #928 added ids) and **hardcodes "2 minutes"** beside `REQUEST_TIMEOUT_MS = 120_000`. Also: the `AbortSignal.any` fallback drops the timeout entirely on engines without it, and the hook's timeout test **cannot catch that** because it mocks the rejection instead of the clock. The Stop button is rendered whenever `isLoading`, but `onStop` is optional — an unwired caller gets a dead button. |
| **#925** Plans 161/162 | — | **do not merge** | §6. |

## 3. Merge order (built and gated, not guessed)

### 3.1 Order

```
922 → 924 → 920 → 930 → 929 → 928 → 926 → 927 → 923        (#925 last, after §6)
```

Dependency PRs first so the lockfile is regenerated once; isolated UI next; the
AI-harness cluster in the order that keeps each later diff smaller than the state it
lands on; #925 separated until it is green.

### 3.2 The four conflicts, and how each must be resolved

| Pair | File | Conflict | Correct resolution |
|---|---|---|---|
| #929 × #930 | `mobile-drawer.tsx` | `lucide-react` import line | Union of what is **actually referenced**: `{ X, Sun, Moon, Monitor }`. `Search`/`FileText` are unused after #910. |
| #924 × #922 | `package.json` | adjacent `pnpm.overrides` lines | Union: keep `sharp: ^0.35.5` **and** add `source-map-js: ^1.2.2`. |
| #926 × #928 | `ai-harness-chat.tsx` | transcript `<div>` attributes vs `key` | Take #926's `role="log" aria-live="off" aria-label` **and** #928's `(m, index)` map + stable key. |
| #926 × #928 | `ai-harness-chat.test.tsx` | both append at the same anchor | Keep both test blocks (they share the trailing `})`). |
| #927 × #928 | `use-ai-harness-chat.ts` | same `setMessages` line | **Semantic**, not textual: #927 deleted the `msg` local that #928's line references. `tsc` would have caught it only after the merge. Resolve to `{ id: crypto.randomUUID(), …, content: \`[Error] ${friendly}…\` }`. |

### 3.3 Two landmines to respect when merging on GitHub

1. **#929 predates #910's refactor of the same file.** Its 419-line
   `mobile-drawer.tsx` still contains the inline search UI that #910 replaced with a
   7-line `SearchTab` wrapper over `EntitySearchPanel`. The textual conflict is only
   the import line, so a `git checkout --theirs mobile-drawer.tsx` (or any
   "take the PR side" reflex) **reverts #910's extraction**. The correct result keeps
   the shared panel and the union import. This is the same shape as the regression in
   §5 — it has already happened once in this repo.
2. **#925 also predates #910** and additionally rewrites `pnpm-lock.yaml`. Landing it
   before the dependency PRs will conflict in `package.json` **and** the lockfile.

## 4. Post-merge defects found and fixed (integration branch)

Neither of these is visible to any single PR; both only exist in the merged tree.

1. **#923's timeout path bypassed #927 and #928.** It appended a message with a
   hardcoded English string and **no `id`**, defeating the i18n PR merged two steps
   earlier and re-introducing the unkeyed-message path just fixed. Fixed: the copy
   moved to `ai.chat.error.timeout`, the duration is derived
   (`REQUEST_TIMEOUT_MS / MS_PER_MINUTE`) instead of restated as "2 minutes", and the
   bubble gets a `crypto.randomUUID()` id. #923's own test still passes unchanged
   (43/43 in the two chat test files), which is the check that the fix kept intent.
2. **My first version of that fix failed `typecheck`** — `MessageEntry` is
   `string | ((...args: string[]) => string)`, so a `(minutes: number)` entry is a type
   error; the repo's convention is `translate('key', String(n))` (4 existing call
   sites). Recorded because it is the exact failure mode a "small i18n tweak" hides:
   the unit tests passed, only `tsc` caught it.

## 5. Regression on `main` — the live advisory has a cause (NEW)

`git log -S` shows PR **#910** (`8759327`, the current tip of `main`) **rolled back four
dependency bumps** that had already landed:

| Specifier | Before #910 | After #910 |
|---|---|---|
| `next` | `^16.3.8` | `^16.3.6` |
| `react-day-picker` | `^10.0.2` | `^10.0.1` |
| `@tanstack/react-virtual` | `^3.14.13` | `^3.14.9` |
| `eslint-plugin-react-refresh` | `^0.5.7` | `^0.5.3` |

`pnpm audit` against `main`'s own package.json+lockfile pair reports **`next@>=16.0.0
<16.3.8` — Server-Side Request Forgery in Image Optimization (HIGH)**, plus `sharp`
and `source-map-js`. `main`'s lockfile is *self-consistent* (`specifier: ^16.3.6`,
`version: 16.3.6`), so nothing in CI looks broken — the advisory gate just stays red,
which is the most expensive way to be wrong.

**Fix applied on the integration branch**: the four specifiers were restored and the
lockfile regenerated. This is evidence-backed, not a guess — PR #925 independently
carries the same four specifiers and its Build / Unit Tests / E2E / Quality Gate jobs
are green. `pnpm install --lockfile-only` on `main`'s tree had already resolved
`next` to 16.3.8 under `^16.3.6`, so the old specifier bought nothing but the advisory.

## 6. #925 — why it is blocked, and what to split it into

**Not a dependency problem.** `pnpm audit` on #925's lockfile is *strictly better* than
`main`'s: the same three HIGH advisories minus `next`. The failing checks are about its
own new code:

| Check | Conclusion | Detail |
|---|---|---|
| `Trivy` (github-advanced-security) | **failure** | "1 new alert including 1 high severity security vulnerability" — a **code-scanning** alert from the SARIF upload, not the `Trivy Filesystem Security Scan` job (which passed). The alert body could not be read here (no credentials / rate limit); it is visible in the repo's Security tab. Diff-grep for secret-shaped strings across all 38 changed files found nothing. |
| `Codacy Static Code Analysis` | **action_required** | "3 new issues (0 max.) of at least minor severity", with complexity increasing per file — `app-shell.tsx` **+8**, `offline-indicator.tsx` also listed. Codacy blocks on any new issue by policy, so these must be fixed or documented as false positives, not merged past. |

**Roast.** The PR is a 4-in-1: PWA precache manifest + recovery snapshots + a
hydration-safe `useReducedMotion` rewrite + a React 19.3.0 bump, plus CI filter changes
and six plan documents. Each quarter is good work — the `useSyncExternalStore`
hydration fix and the `ImportOutcome` type (`backupPersisted` separate from `success`)
are exactly the right calls — but a PR that changes persistence *and* the framework
cannot be canaried, and `AGENTS.md`/`DELIVERY-LIFECYCLE.md` put both in the
highest-risk class. Specific noise:

- The `.github/workflows/security-scan.yml` hunk is **comments only** (three comment
  lines dedented by two spaces). There is no behaviour in it, yet it lands in the most
  sensitive workflow in the repo and makes the PR look like it touches the security
  pipeline.
- `data-slice.ts` gains two content-free JSDoc lines — `/** The snapshot. */` and
  `/** The outcome. */` — beside well-named locals. Pure noise.
- `offline-indicator.tsx` publishes a CSS custom property on `document.documentElement`
  and deliberately defers cleanup to `AnimatePresence.onExitComplete`. The reasoning is
  documented and sound, but it makes the shell's padding a function of another
  component's animation lifecycle — a coupling worth an ADR line if it survives.

**Recommended split** (four PRs, in this order): (a) the dependency bump alone — it
also re-fixes §5; (b) the PWA precache + `offline` CI filter + e2e suite; (c) the
recovery snapshot + `ImportOutcome` (needs shadow + canary per the lifecycle doc);
(d) the `useReducedMotion` hydration rewrite, which is small and independently
testable.

## 7. Issue triage (18 open)

**No issue is closeable as "no impact".** All 12 issues that no PR covers were
re-verified against the current tree today and every claim still holds:

| Issue | Verification against the tree | Verdict |
|---|---|---|
| #886 model/endpoint defaults drift | lists still live in `src/lib/ai/types.ts`, `index.ts`, `src/lib/studio/ai-settings.ts` | keep |
| #887 aria-live streaming | **closed by #926** | closes on merge |
| #885 timeout/Stop | **closed by #923** | closes on merge |
| #884 raw provider errors | **closed by #927** | closes on merge |
| #883 content-keyed keys | **closed by #928** | closes on merge (with §9 F5) |
| #873 system theme | **closed by #929** | closes on merge |
| #870 view chrome patchwork | not re-verified in this pass (broad, subjective) | keep |
| #867 drawer tablist | **closed by #930** | closes on merge |
| #865 nav labels in 3 maps | `NAV_GROUPS` in `sidebar.tsx`, consumed inline by `mobile-drawer.tsx` | keep |
| #863 destructive actions, no confirm | no ConfirmDialog exists; `DISCARD_CHANGES_TEXT` (`editor-hooks.tsx:36`) and `aria-label="Clear chat history"` (`chat-subcomponents.tsx:426`) both act immediately | keep — **highest value: data loss** |
| #862 drawer touch targets | partially mitigated by #910's 44px pass, not closed | keep |
| #861 library rows `role="link"` | `library-entities.tsx:348` still `role="link"` | keep |
| #858 pre-v4 `@layer` utilities | `globals.css:218` / `:280` still `@layer base` / `@layer utilities` | keep |
| #856 status bar announces keystrokes | `editor-hooks.tsx:262` — `aria-live="polite" aria-atomic="true"` wraps the word/char spans | keep |
| #855 arbitrary `text-[Npx]` | 237 occurrences today (issue said 244) and **2 are still below the 9px floor** | keep |
| #853 hex palettes in TS | `sync/cursors.ts:30`, `sync/presence.ts:16` live hex arrays | keep |
| #852 magic `44px` | **161 occurrences today vs 109 when filed** — the problem grew 48% in 11 days | keep, and note the growth |
| #851 entity-type colors | `lib/studio/entity-types.ts:79` (`bg-zinc-100`), `lib/studio/types.ts:92` (`bg-sky-100`) | keep |

**Suggested order for the 12**: #863 (data loss) → #861, #856 (real a11y bugs, small) →
#865, #886 (drift) → #851, #853, #852, #855, #858 (one token sweep, together) → #862,
#870. Do **not** start the token sweep (#851/#852/#853/#855/#858) piecemeal: five
overlapping sweeps over the same files will conflict exactly like §3.2.

## 8. Blockers, and the commands to finish this

**Blocker**: no GitHub write access in this environment (`GET /api.github.com/user` →
401; `gh` absent; unauthenticated core limit 60/h, exhausted). Everything below is
therefore *prepared and verified*, not executed.

```bash
# 9 green PRs, in the verified order. Each is a squash merge (required_linear_history).
for pr in 922 924 920 930 929 928 926 927 923; do
  gh pr merge "$pr" --squash --delete-branch   # only after its branch is rebased on main
done
gh pr merge 925 --squash --delete-branch       # BLOCKED — see §6
```

Before merging, each branch must be updated with `main` (the AI-harness four conflict
with each other, and #929/#925 conflict with #910's refactor — see §3.3).

Branch produced by this pass, for inspection or use:
`integration/land-open-prs` (9 PRs merged, 4 conflicts resolved, 2 semantic defects
fixed, 4 reverted dependency bumps restored; lint 0 / typecheck 0).

## 9. Follow-up issue drafts (not filed — no write access)

- **F1 — Restore the four dependency bumps PR #910 rolled back.** `next ^16.3.6`
  re-arms the HIGH SSRF advisory on `main`; `pnpm audit` reproduces it against `main`'s
  own lockfile. Evidence table in §5. (Severity: security, high. Fix is 4 lines +
  lockfile.)
- **F2 — Move `'Response complete'` (and the timeout copy) into i18n.**
  `ai-harness-chat.tsx` renders hardcoded English beside a 19-module i18n system
  (AGENTS.md violation). (Severity: low, housekeeping.)
- **F3 — Replace regex error classification with typed provider errors.**
  `use-ai-harness-chat.ts` matches on provider prose; a provider copy change silently
  degrades every error to "unexpected". (Severity: medium, correctness.)
- **F4 — `.gitattributes` marks `pnpm-lock.yaml` `-diff merge=ours`, and no `ours`
  merge driver is configured.** Consequences: lockfile changes are invisible in review,
  every concurrent dependency PR conflicts, and contributors are invited to "resolve"
  by taking one side — which is how §5 happened. Either define the driver or drop the
  attribute. (Severity: high, process — it has already caused one regression.)
- **F5 — `key={m.id ?? \`${index}-${role}\`}` re-introduces the #883 bug for any
  message without an id.** The fallback is dead code today and a silent regression
  tomorrow. (Severity: low.)
- **F6 — Split #925 into four PRs** (§6) and land the React bump separately.
  (Severity: high, delivery risk.)
- **F7 — `.githooks/commit-msg` rejects git's default merge subjects**, so a local
  `git merge` cannot complete without a hand-written conventional message and the repo
  has no documented merge-commit convention (every merge here needed
  `-c core.hooksPath=/dev/null` or an invented subject). Document it or exempt merges.
  (Severity: low, developer experience.)
