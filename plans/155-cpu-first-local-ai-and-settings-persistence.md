# Plan 155 — Local CPU-First AI and Settings Persistence

**Date**: 2026-09-26
**Status**: Implemented
**Related**: ADR 040, ADR 025

## Goal

Make CPU the invariant default for every local inference path, close the
persistence gap that made the WebGPU toggle unreachable, and fix a settings
autosave defect that silently discarded edits.

## What changed

### CPU-first defaults

`ollamaCpuOnly` now defaults to `true` in `StoredSettingsSchema`,
`DEFAULT_SETTINGS`, and the harness view state, matching the in-browser
provider's `LOCAL_DEFAULT_DEVICE = 'wasm'`. The `applyStoredSettings` fallback
was realigned to `DEFAULT_SETTINGS` so it cannot contradict the invariant if
it is ever reached. Existing installations keep a stored `ollamaCpuOnly: false`
verbatim, so the flip only affects new installations.

### `localDevice` persistence

`ChatRequest.localDevice` was already consumed by `local-adapter.ts` but had no
route from the UI, so the WASM/WebGPU choice was unreachable. It is now
threaded through the schema, `AISettings`, the load and save paths, the view
state, the chat hook, and a select in the settings panel.

### Settings autosave defect

The settings panel autosaves on every state change, and `StoredSettingsSchema`
rejects a base URL that does not parse. Typing a base URL character by
character therefore fired a **failing** save on most keystrokes (`htt`, `ht`,
`http:`, …): the schema rejected each partial host, the stored record kept the
last good value, and the field appeared to edit while silently discarding the
change. One typing session accumulated **164**
`Failed to save AI settings: Invalid AI settings schema` errors.

`BaseUrlInput` fixes this by keeping a local draft and committing on blur (or
Enter), normalizing through the guard. A rejected value leaves storage
untouched and is reported on the field via `aria-invalid` plus a
described-by message rather than a toast. The component takes an explicit `id`
because `Field` only injects one into native inputs, not into components.

### IPv6 loopback allowlist

`ALLOWED_LOCAL_HOSTS` listed a bare `::1`, but `URL.hostname` returns the
bracketed form `[::1]`, so the entry could never match and a valid IPv6
loopback Ollama URL was rejected as an untrusted remote host. Both spellings
are now listed, and a test that previously documented the broken behavior is
inverted. The base-URL guard moved to `src/lib/ai/url-guard.ts` so the
allowlist has one definition rather than a copy in `providers.ts`.

## Verification

- `pnpm run typecheck` — 0 errors.
- `pnpm run test` — 2662 passed, 1 skipped.
- `pnpm run lint` and `pnpm run build` — clean.
- Browser smoke: selecting Ollama shows the CPU-only switch `checked=true` by
  default; the local provider shows the inference-device select defaulting to
  `wasm`; a valid base URL persists across reload while a half-typed host
  leaves storage unchanged and sets `aria-invalid`.

## Not included

An integration of the TypeSafe Jev decision API was attempted and rejected. Per
the vendor's own documentation, Jev is a System One decision model — it
returns typed `choice` / `score` / `noul` answers and **does not generate
text or hold a conversation**, so it is not a drop-in chat provider. The
adapter that shimmed a conversation into a `choice` question would have shown
a confidence percentage where an answer belongs. Several supporting details in
the originating plan were also unverified and incorrect (`von-1.2` is not a
model; no local Von server is documented; 402/403 are not error codes).

A decision-service integration built on the documented primitives — with
model, question type, criteria, and confidence threshold all user-configurable
and optional — is the correct shape for that capability and is left for a
separate plan.
