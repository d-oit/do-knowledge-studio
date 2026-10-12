# Plan 163 — Open-PR / open-issue sweep, roast, and land (2026-10-12)

> Session record. Supersedes the open-work half of Plan 116 (whose W3 "merge
> order" table is now historical). Every claim below was observed on a real
> tree or a real API response during this session; nothing is projected.

## 0. Inventory at session start (GitHub API, 2026-10-12)

**10 open PRs:** #920, #923, #924, #925, #926, #927, #928, #929, #931, #932.

**17 open issues:** #851, #852, #853, #855, #856, #858, #861, #862, #863, #865,
#870, #873, #883, #884, #885, #886, #887 — five of them claimed by harness PRs
(#883→#928, #884→#927, #885→#923, #887→#926) and two by newer PRs (#873→#929,
#861→#931).

Ruleset in force on `main` (id 15161694, `active`): `deletion`,
`required_linear_history`, `required_status_checks` (exactly **one** required
context — `Codacy Static Code Analysis` — with
`strict_required_status_checks_policy: true`), `pull_request`
(`required_review_thread_resolution: true`, `required_approving_review_count: 0`),
`code_quality`, `code_scanning`. Consequences that shaped this session:

- `strict` + linear history means **every** merge pushes the other PRs behind,
  and GitHub's auto-merge does **not** update a behind branch — so a merge queue
  needs an explicit `PUT /pulls/{n}/update-branch` pass (`/tmp/babysit.py`,
  used throughout; it only updates when CI is idle so it never cancels a run).
- Review threads — including **outdated** ones — block. GitNexus re-posts stale
  findings as fresh threads on every push (LESSON-034), so a single force-push
  can triple the thread count.

## 1. Verdicts

**Closed: 1 PR.** #932 is a fork-based duplicate of #927 (same fix for #884,
different branch). Closed with a credited explanation rather than merged: two
divergent `useAiHarnessChat` error paths would conflict forever on the same
catch block. Nothing else closed — see §2: closing the rest would have been
tidiness theater, because every PR carried a behaviour change, an alert fix, or
tests, and every issue reproduced.

**Merged (verified in `origin/main`):**

| PR | Merge commit | What it fixed |
|----|--------------|---------------|
| #920 | `6c4b20d` | tooltip title on the right-panel close button |
| #931 | `583e820` | #861 — library table rows use native semantics, the open action is a real button |
| #923 | `ab26b78` | #885 — AI request timeout + Stop, rebuilt on an engine-independent timer |
| #935 | `3919baf` | #865 — one nav message module instead of three hardcoded maps |
| #933 | `1e519e8` | new: `node_modules` symlink ignore + a root `tsc` error every contributor paid for |
| #934 | `56428ea` | new: four dependency ranges that #910 had silently downgraded |
| #924 | `d1ccc85` | source-map-js override, clearing Dependabot alert #75 |

## 2. Roast — what was actually wrong

Each item was reproduced before being touched; each fix carries a test that was
**verified to fail with the defect re-injected** (LESSON-041).

### Real defects in the open PRs (not style opinions)

1. **#923's timeout was dead on engines without `AbortSignal.any`.** The fix
   composed `AbortSignal.any([controller.signal, AbortSignal.timeout(ms)])` and
   fell back to `controller.signal` alone — silently dropping the timeout. A
   provider that accepted the request and then went silent hung the turn forever
   with Stop as the only escape. Replaced with a `setTimeout` that aborts the
   turn's own controller: no newer-than-ES2020 API to feature-detect, no gap.
2. **#923's Stop button called `window.stop`.** `AIHarnessView` passed
   `onStop={stop}` without destructuring `stop` from the hook, so the bare
   identifier resolved to the browser global (which aborts document loading, not
   the turn) and typed as a valid handler because `Window.stop` is `() => void`.
3. **#923's follow-up, found by review of my own fix:** the Ollama model refresh
   called `AbortSignal.timeout(10_000)` directly — the same compatibility hole,
   one file over, where it throws *before* the fetch. The budget moved inside
   `fetchOllamaModels` (its `signal` parameter had no caller).
4. **#928 shipped UI ids to the model providers.** `ChatMessage.id` was passed
   through `buildMessagesAsync` into the request body, and the OpenRouter/Ollama
   adapters serialized `messages` verbatim. One `toProviderMessages` mapper now
   strips everything but `role`/`content` at the provider boundary, asserted on
   the actual serialized body (not a copy) for both adapters.
5. **#926 announced failure and abort as success.** The status region keyed on
   `isLoading`, so a provider rejection and a user Stop both spoke "Response
   complete" — and the string was hardcoded in a repo with a 19-module i18n
   system. The hook now exposes a `completedTurns` counter incremented only on a
   turn that produced assistant content and neither errored nor aborted.
6. **#925 relied on a clear that could fail silently.** The oversized-import path
   called `clearRecoverySnapshot()` to stop a later restore handing back the
   corpus a prior import replaced — but that helper caught a refused
   `removeItem` and returned `void`, so the outcome still reported `too-large`
   ("your previous library cannot be restored from here"). It now returns
   whether the key is gone, and a refused removal reports the storage refusal
   that is actually true.
7. **#925's two banner e2e tests could not fail for the stated reason.** The
   position poll rejected only a *positive* top, so during the slide-in from
   above (negative top) it proceeded against a half-entered banner; the release
   test waited for `paddingTop === 0` and then for the banner to disappear,
   which both a correct and a premature release satisfy. The first now waits for
   the resting position of a `fixed top-0` element; the second samples both facts
   in one evaluation and fails if any sample shows the reservation gone while the
   banner is still on screen.
8. **#927 and #923 disagreed on copy.** #923's timeout message was a hardcoded
   English string in the same `catch` that #927 was converting to i18n keys. The
   timeout and the shared hint now come from `ai.chat.error.*` too.

### Two defects found outside the PR list — both on `main`

9. **PR #910 silently downgraded four dependencies.** Regenerating
   `package.json`/`pnpm-lock.yaml` from a stale base lowered `next`
   `^16.3.8`→`^16.3.6` (reverting dependabot #914), `react-day-picker`
   `^10.0.2`→`^10.0.1`, `@tanstack/react-virtual` `^3.14.13`→`^3.14.9`, and
   `eslint-plugin-react-refresh` `^0.5.7`→`^0.5.3`. `git log -S` confirms the
   direction of each change. Restored in PR #934 (verified with a real
   `pnpm run build` on the restored tree, and the precache manifest regenerated
   because the framework's emitted chunk URLs move with it).
10. **Repo hygiene that cost every contributor.** `.gitignore` listed only
    `node_modules/`, whose trailing slash is directory-only — so a worktree that
    symlinks its dependencies had the symlink staged by a blanket `git add -A`
    (it reached a PR branch and had to be force-pushed away). And
    `src/lib/speech-coverage.test.ts` called `afterEach` without importing it:
    `globals: true` hides it at runtime, but the repository-root `tsc --noEmit`
    reported it as the **only** remaining error, and three separate verification
    passes this session stopped to check whether they had caused it. Both fixed
    in PR #933.

### Process hazards observed

- **An automated re-run on #923's branch (`d415e9b`) built on an older `main`:
  relative to `main` it deleted `src/components/studio/entity-search-panel.tsx`
  (reverting #910) and resurrected pre-#911 files.** Merging it would have
  reverted `main`. It was dropped in favour of a force-push to the reviewed
  parent; nine of the fourteen review threads on #923 were findings against that
  tree (files that are not in the PR at all), which is now recorded here so the
  next sweep does not re-litigate them.
- **Codacy's PR snapshot can be older than the head commit.** The three findings
  on #925 pointed at `scripts/generate-precache-manifest.mjs` lines 108–144 in a
  version whose `readdir`/HTML-extraction code no longer exists at head (the
  file is 86 lines and has no `readdir`). `--reanalyze` was requested rather than
  suppressing or "fixing" phantom lines.
- **Vercel preview deployments fail on several branches** (`Deployment has
  failed`, and `Authorization required to deploy` on the fork PR). Not
  ruleset-required, so they do not block merges, but a red ✗ on every PR trains
  people to ignore red ✗s.

## 3. Issues implemented this session

| Issue | PR | What landed |
|-------|----|-------------|
| #865 | #935 | One `nav` message module feeds `VIEW_NAMES`, `VIEW_TITLES`, `NAV_GROUPS`, plus the search-mode toggles and the mind-map toolbar; rendered text byte-identical, so no expectation needed re-pinning. |
| #861 | #931 | Table rows are rows again; the open action is a `<button aria-label="Open X">`. Keyboard activation proved in a real browser for Enter **and** Space, and the tab-order assertion rejects every negative `tabindex` (not just `-1`). |
| #851, #852, #853, #858 | #938 | `--spacing-touch` token + ~109 call-site migration; custom utilities moved to v4 `@utility` so variants compile (proved by compiling the real stylesheet and asserting the generated CSS); one palette source per palette (export theme, presence colours, mindmap fallback); entity-type colours render the tokens they name, and the neutral fallback stops using the banned cool grey. |
| #870 | #936 | One container constant and one `ViewHeader` whose policy (every page-shaped view; chat and editor documented exemptions) lives in `DESIGN-SYSTEM.md`; Graph and Mind Map empty states gained the create action they were missing. |
| #886 | #937 | `DEFAULT_MODEL.openrouter`/`DEFAULT_OLLAMA_BASE_URL` replace the copies; the drifted `OPENROUTER_DEFAULT_MODELS` and the never-read `ProviderOptions.models` field are gone; `getProviderEndpoint` deleted after `grep` proved it had no caller. |
| #863, #856 | #939 | One shared `ConfirmDialog` gates "Clear chat" and "Discard changes", and both one-off dialogs are deleted; the editor's word/char counters left the live region, so typing no longer narrates the whole session. |

## 4. Follow-ups (recorded, not silently dropped)

1. **Merge the remaining queue** in this order (each is armed for auto-merge;
   the queue needs `update-branch` passes because of `strict` checks): #925 (widest
   blast radius, three threads fixed this session) → the harness stack #926 →
   #927 → #928 (rebased onto each other's main state) → #929 → #936/#938/#939 →
   #937.
2. **No-downgrade guard.** Nothing in CI notices when a dependency range moves
   *backwards*; #910 shipped that way and only a human reading `git log -S`
   caught it. A cheap check — compare each `dependencies`/`devDependencies`
   range in `package.json` against `main`'s and fail when a semver-minor/patch
   range is lower — would have caught #910 at review time.
3. **Automated branch writers must rebase onto `main` before pushing.**
   The `d415e9b` incident is the second time a stale-base automation branch
   arrived with a `main`-reverting tree (Plan 116 recorded the first). A guard in
   the PR template or a CI check ("does this PR delete files that `main` gained
   after the merge base?") would surface it in seconds instead of at review.
4. **Codacy staleness:** when findings point at lines the head commit does not
   contain, request `--reanalyze` and reply with the evidence — do not suppress
   and do not "fix" phantom code (LESSON-034/039).
5. **Open issues at close of session:** #855 (244 `text-[Npx]` → token steps) and
   #862 (drawer/shortcuts touch targets), both in flight as
   `issue/touch-and-type-scale`; #873 is claimed by #929; #883/#884/#885/#887 are
   fixed by the harness PRs still in the queue.

## 5. Verification discipline used throughout

- Every fix was reproduced before it was touched, and every new test guarding a
  regression was **re-injected with the defect and observed to fail** before
  being restored (the session's fix commits name the failure).
- Unit suites were run per lane (`--maxWorkers=2`, several agents in parallel);
  the repository-root `tsc --noEmit` and the real Playwright suite were run where
  the change made them meaningful (e2e for keyboard activation, the offline
  banner, and the library table).
- No claim in this document rests on a plan, a PR description, or memory: the
  merge commits are in `origin/main`, the threads were resolved with the evidence
  posted, and the two `main` regressions above carry their own reproduction.

## 6. Addendum — the second half of the session

Section 1 above is the opening inventory. This is what the queue actually took,
recorded because the shape of the work changed: the sweep became a merge-queue
drain with a review pass that kept finding things.

### 6.1 New PRs opened by this session (beyond the initial ten)

| PR | Why it exists | Status |
|----|---------------|--------|
| #933 | `.gitignore` ignored only `node_modules/` (directory-only), so a worktree's symlinked `node_modules` was staged; `speech-coverage.test.ts` called `afterEach` without importing it, the lone error in the repository-root `tsc` run | merged |
| #934 | #910 had silently **downgraded four dependency ranges** (see §6.3) | merged |
| #935 | #865 — one nav message module | merged |
| #936 | #870 — view chrome, empty states, header policy | merged |
| #937 | #886 — model/endpoint defaults | merged |
| #938 | #851/#852/#853/#858 — token system | in queue at close |
| #939 | #863/#856 — shared `ConfirmDialog`, quiet editor counters | in queue at close |
| #940 | this plan, `LESSON-042..045`, the compacted index, two skill updates | in queue at close |
| #941 | WCAG 2.5.3 fix for the theme toggles (#929 shipped a P1 that review caught **after** it merged) | in queue at close |
| #942 | #862/#855 — touch targets and the type-scale migration | in queue at close |
| #943 | the post-merge e2e regression below | in queue at close |

### 6.2 The regression the batch produced, and how it was found

After the chrome PR merged, a **full Chromium run against `main`** — not per-PR,
against the merged state — failed **25 tests**. One cause: every page-shaped view
now renders a hero heading (#870) while the shell topbar owns the same view's
`h1`, so `page.getByRole('heading', { name: /library/i })` matched two elements
and Playwright's strict mode failed. Eleven specs were written that way, most of
them about a *different* view than the one the chrome PR touched.

It was invisible to CI because each PR's e2e job runs against that PR's own tree.
**The lesson is the one this repo already learned once (LESSON-041): a green
per-PR suite is not a green `main`** — a batch of merges needs one full-suite run
against the result. Fixed in #943 by introducing `viewHeading()` in
`e2e/helpers/navigation.ts`, which scopes the query to `#main-content` — the
convention `DESIGN-SYSTEM.md` §11 already states (the shell owns the only `h1`).
Verified: the same suite goes **25 failed / 137 passed → 162 passed, 0 failed**.

Also observed while measuring, and **not** fixed here: a hydration mismatch
warning on first load, from a framer-motion progress bar animating to a
client-computed width (`style="width: 12.5%"`) while the server rendered `0px`.
It does not fail any test; it is recorded in §6.4.

### 6.3 Two more defects found on `main` (not in any PR)

1. **Four dependency ranges had been downgraded by #910**: `next` `^16.3.8` →
   `^16.3.6` (reverting dependabot #914), `react-day-picker`, `@tanstack/react-virtual`
   and `eslint-plugin-react-refresh`. `git log -S` proved the direction; nothing in
   CI notices a range moving backwards. Restored in #934 with a real
   `pnpm run build` on the restored tree and a regenerated precache manifest.
2. **An automation re-run on #923's branch had rebuilt its tree on a stale base**:
   relative to `main` it deleted `entity-search-panel.tsx` (reverting #910) and
   resurrected pre-#911 files. Merging it would have reverted `main`. Dropped in
   favour of a force-push to the reviewed parent. Nine of that PR's fourteen
   review threads were findings against that phantom tree.

### 6.4 Follow-ups (carried forward)

1. **Hydration mismatch on first load** — a progress bar's width animates from the
   server's `0px` to a client-computed percentage (seen in the console during the
   #943 verification run, in an AI-harness spec's page). Not covered by the
   existing `hydration-mismatch.spec.ts` (which covers the reduced-motion case
   #925 fixes). Deserves the same A/B treatment: `useSyncExternalStore` or a
   server-known initial width.
2. **No-downgrade guard** (§6.3.1) — CI still cannot see a dependency range moving
   backwards.
3. **Stale-base guard** (§6.3.2) — a check that fails a PR whose diff *deletes*
   files `main` gained after the merge base would surface that class in seconds.
4. **Vercel preview deployments fail on most branches** (not ruleset-required, so
   never a merge blocker). The correlation with this session's push volume
   (~25 pushes in a day, one or two deployments each) suggests a quota rather than
   a config fault; worth one look before treating it as normal.
5. **Codacy's analysis snapshot can lag the head commit** — the three findings on
   #925 cited `scripts/generate-precache-manifest.mjs` lines that no longer exist
   at head. Re-analysis was requested and the findings suppressed as build-script
   false positives with the reasoning posted on the PR, per `GIT-WORKFLOW.md`.
6. **Remaining open issues:** none unimplemented — all seventeen in §0 are either
   fixed by a merged PR (#861, #865, #873, #883, #884, #885, #887) or by one in the
   queue (#851, #852, #853, #855, #856, #858, #862, #863, #870, #886).

### 6.5 What "done" meant here

Every claim in this plan was produced by running something: the suites, the
merged-state e2e, the browser probes for the offline banner, the compiled-CSS
measurements for the `@utility` conversion, the geometry probes for the
clear-filter gutters, and the first-paint MutationObserver probe for the banner
reservation. Where a probe could not be run (no browser available in a lane, no
Vercel credentials), this document says so instead of asserting a pass.

## 7. Close-out — what landed, and what is deliberately left

### 7.1 Merges

Everything the sweep opened or adopted is in `origin/main`. The merge commits,
in order:

| PR | What it landed |
|----|----------------|
| #920 | tooltip title on the right-panel close button |
| #931 | #861 — native table semantics, a real button for the open action, plus real-browser Enter/Space proof |
| #923 | #885 — request timeout armed with `setTimeout` (engine-independent) and Stop bound to the turn |
| #933 | hygiene: `node_modules` symlink ignore, the fleet-wide `afterEach` import |
| #934 | the four dependency ranges #910 had downgraded |
| #935 | #865 — one navigation message module |
| #924 | source-map-js override (Dependabot alert #75) |
| #936 | #870 — container constant, `ViewHeader`, empty states with a real CTA |
| #929 | system theme + `theme-color` sync |
| #937 | #886 — one source for model/endpoint defaults |
| #928 | #883 — stable message ids, stripped at every provider boundary |
| #927 | #884 — friendly provider errors, raw text logged only |
| #941 | WCAG 2.5.3 for the theme toggles (#929's P1, caught by review after merge) |
| #940 | this plan, `LESSON-042..045`, the compacted `plans/INDEX.md`, two skill updates |
| #943 | the 25-failure post-merge e2e regression (`viewHeading` scope) |
| #942 | #862/#855 — 44px touch targets with a real measurement, the type-scale migration |
| #926 | #887 — announce completion and failure, never both for one turn |
| #938 | #851/#852/#853/#858 — `--spacing-touch`, `@utility`, one palette per palette |
| #939 | #863/#856 — shared `ConfirmDialog`, quiet editor counters |
| #944 | the quality-gate conflict-marker check |

**All seventeen issues in §0 are closed**, each by the PR credited above.

### 7.2 Findings the final sweeps turned up (fixed, not deferred)

- **`/manifest.webmanifest` was precached but not served offline** — the worker's
  extension list lacked `.webmanifest`, so an installed PWA lost its manifest
  exactly when it needed it. The parity test now derives extensions from the
  generator's explicit URL list too.
- **The mind-map export's paper fallback was inert in a real browser** — a
  transparent element reports the *truthy* `rgba(0, 0, 0, 0)`, so
  `computedBackground || resolvePaperBackground()` never reached the fallback.
  jsdom reports `''`, which is why the test looked like it covered it; the spec
  now uses the browser's value.
- **A resize during the banner's exit left a stale reserved height** — the
  observer was tied to `isOffline` rather than to the element's lifetime;
  measurement moved into a ref callback.
- **The confirm dialog announced its question but not its warning** — `Overlay`
  gained `aria-describedby`, and the dialog now labels itself by the heading and
  describes itself by the body.

### 7.3 Follow-ups carried forward (not fixed here)

1. **`Overlay` focus restoration when the trigger has unmounted** (found on
   #939, declined there): after an action removes the element that had focus, the
   restore targets a disconnected node and focus falls to `<body>`. The
   right-panel delete dialog has the same shape today, so the fix belongs to
   `Overlay`'s contract rather than to one dialog — recorded here so it is fixed
   once, for every overlay.
2. **First-load hydration mismatch** in `home-view.tsx`: a `motion.div` animates
   its width to a store-derived percentage while the server renders `0px`, so
   React discards and regenerates that subtree. Seen in the console during the
   #943 verification run; unrelated to the reduced-motion case #925 fixes.
3. **No-downgrade guard** and **stale-base guard** for CI (§6.4).
4. **Vercel preview deployments** fail on most branches (never ruleset-required);
   the correlation with this session's push volume suggests a quota.
5. **Thread churn**: GitNexus re-posts findings on every push, so a queue of
   twelve PRs needed a sweep after each push — and a branch whose remote head was
   replaced by a stale-base automation commit produced fourteen findings about
   files it did not touch. Both are worth a harness rule; §6 notes the symptoms.
