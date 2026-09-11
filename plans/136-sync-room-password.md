# Plan 136: Reachable WebRTC Room Password

**Goal**: Let a user actually turn on encrypted peer sync.

## Context

Plan 134 added `password?: string` to `joinRoom`'s options, which `y-webrtc` uses to derive
an AES-GCM key for the signaling and data channels. That objective landed at the API
boundary only: the single production caller, `sync-view.tsx`, invokes `joinRoom(id)` with no
options, and no UI exists to set a password. Encryption was therefore unreachable — a
security control that can never be switched on.

This was surfaced as a P2 finding during the pre-merge review of PR #776 and is tracked here.

## Objectives

1. **Password input**: Add a "Room password" control to the disconnected panel of
   `SyncStatusCard`, wired through `SyncView`.
2. **Pass through on join**: Forward the trimmed value to `joinRoom` as
   `{ password }`, omitting the key entirely when blank so the unencrypted path is
   byte-for-byte unchanged.
3. **Do not leak the secret**: The password must never enter the sync event history, a
   toast, `localStorage`, or the store. It lives only in component state and is cleared on
   leave.

## Design notes

- Blank is treated as "no encryption" rather than an empty-string password, so existing
  users get identical behaviour.
- The control is masked (`type="password"`), labelled, and described by help text that
  states the password is never stored or synced. Both peers must supply the same value —
  `y-webrtc` cannot signal a mismatch, so a wrong password fails as an inability to decrypt
  rather than an auth error. The help copy says so.
- User-facing copy is grouped in a module-scope constants map, per the AGENTS.md rule
  against hardcoded strings.

## Quality Checklist

- [x] Password input renders, masked and labelled, and forwards changes. (`sync-helpers.test.tsx`: masked `type`, change forwarding, `aria-describedby`, Enter-to-join)
- [x] `joinRoom` receives `{ password }` when set and is called with **no second argument** when blank. (`sync-view.test.tsx`)
- [x] Password never appears in events, toasts, or persisted state. (test asserts it is absent from the rendered sync history; it is never passed to `addEvent`/`toast` and is not in the store)
- [x] Password cleared on join and on leave.
- [x] Lint, typecheck, tests, and build pass. (159 files, 2374 passed, 1 pre-existing skip; Next.js build clean; both files under the 500 LOC limit at 424 / 298)

## Review note

Passing `undefined` as an explicit second argument broke 11 pre-existing assertions in
`sync-view-coverage.test.tsx` (`toHaveBeenCalledWith('room-123')` does not match
`('room-123', undefined)`). Rather than loosen those tests, the implementation branches and
calls `joinRoom(id)` with a single argument when there is no password, which also makes the
unencrypted path provably unchanged.

### Static analysis

DeepSource's JavaScript analyzer failed this branch on **JS-0067** — `SyncView` was declared
as a top-level `export function`, which the analyzer reads as a global-scope declaration.
The `.deepsource.toml` `skip = true` for JS-0067 does not suppress findings on new code
(LESSON-031, plans/112), so the fix is at code level: `SyncView` is now
`export const SyncView = () => {}`, matching the repo convention. This was pre-existing
style in a file this branch had to touch.
