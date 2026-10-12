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
