# Plan 180 — The search worker never replies

**Date:** 2026-10-20
**Status:** Fixed — verified in a real browser against dev and production builds
**Owner:** integration owner for this sweep
**Found during:** post-merge production verification of the Plan 179 Dependabot drain

## Summary

The search Web Worker booted without an error but never handled a message, so
every search request waited out the client's 3-second fallback timeout before
running on the main thread. Measured in a real browser, each chat reply took
**~3.35 s** instead of ~0.35 s — a 10× latency tax on every query.

The defect predates the Plan 179 merges; it was found while verifying them.

## Root cause

`src/lib/search/search-worker.ts` attached its listener with this guard:

```ts
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e) => { /* … */ }
}
```

Turbopack bundles the worker entrypoint as a module chunk and resolves `window`
**statically**. The comparison folds to `false` at build time, so the entire
block — the `onmessage` assignment included — is dropped from the emitted
worker chunk.

The emitted chunk kept the exported handler and nothing that calls it:

```
90238,e=>{"use strict";var t=e.i(35897);e.s(["handleWorkerMessage",0,(e,r)=>{…}])}]
```

No `onmessage`, no `addEventListener`. The worker therefore loaded cleanly,
reported no error, and silently discarded every `SEARCH` message.

## Why it was invisible

Three independent things hid it:

1. **The worker logs nothing.** A worker that boots and never listens is
   indistinguishable from a healthy one at the console level.
2. **The client degrades gracefully.** `search-worker-client.ts` bounds every
   request with `SEARCH_WORKER_TIMEOUT_MS = 3000` and the chat slice falls back
   to synchronous search, so the feature *works* — just 3 seconds late.
3. **The unit suite cannot see it.** `src/lib/search/search-worker.test.ts`
   imports the module directly under jsdom, where `window` is a real global and
   the guard is never statically resolved. The defect exists only in the
   bundle the browser runs.

## The fix

Test for a dedicated worker scope with `document`, which the bundler cannot
resolve statically:

```ts
const isDedicatedWorkerScope = (): boolean => {
  if (typeof self === 'undefined') return false
  return 'document' in self ? false : true
}

if (isDedicatedWorkerScope()) {
  self.addEventListener('message', (e: MessageEvent<SearchWorkerRequest>) => { … })
}
```

`addEventListener` is used instead of assigning `self.onmessage` so the
listener survives even if a future bundle installs its own handler first.

The emitted worker chunk now carries the listener:

```
"u">typeof self&&void 0===self.document&&self.addEventListener("message",e=>{…})
```

## Verification

Measured with the repo's own Playwright against a real Chromium, chat reply
latency over three consecutive queries:

| Build | Dev | Production (`pnpm run start`) |
| --- | --- | --- |
| Before the fix | 3353 / 3334 / 3349 ms | 3335 / 3321 / 3325 ms |
| After the fix | 366 / 345 / 356 ms | 337 / 325 / 320 ms |

Both the defective and the fixed build were measured from the same tree, and
the pre-merge commit `e5d6571` was measured as the baseline to confirm the
defect predates the Plan 179 merges.

## Regression coverage

`e2e/search-worker.spec.ts` (new):

1. **A latency bound** on a chat reply. A broken worker produces ~3.4 s; a
   healthy one ~0.35 s. The threshold is 2500 ms, between the two with margin
   on both sides.
2. **The constructed worker replies** to a `SEARCH` message. The worker's URL
   is captured by hooking `Worker` at construction time — discovery through
   `performance.getEntriesByType('resource')` proved unreliable, because the
   entry only appears after the script is fetched and Next's own runtime
   worker chunks match the same name.

Both were verified to **fail on the defective code and pass on the fixed
code**:

| | Defective code | Fixed code |
| --- | --- | --- |
| Latency test | `chat reply took 3996ms` / `3922ms` → fail | pass |
| Worker reply test | `the search worker must reply to a SEARCH message` → fail | pass |
| Result | **2 failed** | **2 passed** |

A unit test cannot cover this: the module loads directly under jsdom, where
the guard is never statically resolved. The assertion has to run against the
built app in a real browser.

## Local gate

- `pnpm run lint` — clean
- `pnpm run typecheck` — clean
- `pnpm run typecheck:test` — clean
- `pnpm test` — 3100 passed, 1 skipped (214 files)
- `pnpm run test:e2e --project=chromium` — 215 passed, 1 flaky
  (`error-boundaries.spec.ts` "Unmatched routes", which passed on retry and is
  unrelated to this change)
- `./scripts/quality_gate.sh` — all gates green

## Pre-existing gap found while running the gate (not fixed here)

`scripts/quality_gate.sh` lints every `*.md` under the repository root, and
its exclusion list covers `node_modules`, `target`, `.git` and the vendor
agent directories — but **not** the Playwright output directories
`playwright-report/` and `test-results/`, which are gitignored build output.

So running the e2e suite and then the gate fails on files Playwright wrote:

```
✗ markdownlint failed: ./test-results/error-boundaries-…/error-context.md
  error MD047/single-trailing-newline Files should end with a single newline character
✗ markdownlint failed: ./playwright-report/data/edf5027ce….md
  error MD047/single-trailing-newline Files should end with a single newline character
```

Confirmed **pre-existing and independent of this change**: with the working
tree stashed (pristine `main`) and the artifacts still on disk, the same two
files fail the same rule.

Not fixed here on purpose: AGENTS.md forbids changing lint suppressions or
ignore settings without explicit human approval, and the exclusion list in
`quality_gate.sh` is exactly that. The artifacts this change produced were
removed instead (`rm -rf playwright-report test-results`), which is the correct
way to reach a green gate — the directories are regenerated on every e2e run.

**Follow-up for the maintainer:** decide whether `quality_gate.sh` should skip
gitignored build output. The general fix is to derive the markdown file list
from `git ls-files '*.md'` (tracked files only) rather than from `find`, which
also stops the gate from linting any untracked scratch markdown. That is a
gate-behaviour change and needs the approval AGENTS.md requires.

## Note on the earlier "console error"

While investigating, the browser harness reported
`Search worker encountered unhandled error: Missing worker bootstrap config`.
That was an **artifact of the harness**, which shims `Worker` and loses the
URL fragment the Turbopack worker bootstrap needs. Real Chromium — in this
repo's own Playwright — shows no such error, and the CI Playwright log for a
PR run contains three *other* browser console errors but zero worker errors.
The real defect is the one fixed here: no error, no reply.

## Follow-ups (recorded, not claimed as done)

- `src/lib/search/search-worker-client.ts` still constructs the worker with
  `{ type: 'module' }`. The emitted worker is loaded as a classic script by
  the Turbopack runtime, so the option is inert. It was not changed here
  because the worker now works, and changing the worker type risks the
  `importScripts` failure recorded in the 1.64 worker matrix.
- The 3-second fallback timeout is a reasonable backstop, but with the worker
  fixed it now only covers genuine worker failures. Nothing to change.
