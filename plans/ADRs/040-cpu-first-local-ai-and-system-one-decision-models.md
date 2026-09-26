# ADR 040: CPU-First Local AI and System One Decision Models

**Date**: 2026-09-26
**Status**: Implemented
**Supersedes (in part)**: ADR 025
**Related**: Plan 155, Plan 065

## Context

ADR 025 consolidated the AI Harness onto OpenRouter plus Ollama and made
Ollama's CPU-only mode an **opt-in toggle** (`options.num_gpu: 0` when
enabled). In practice the toggle defaulted to off, so a user who installed
Ollama on a laptop without a working GPU stack got GPU-layer probing failures,
unusable latency on large models, and battery drain — the failure mode that
prompted the toggle existed in the first place. Separately, the TypeSafe Jev /
open-source Von System One decision models became available in September 2026,
and a decision API does not fit the existing OpenAI-shaped adapter contract.

## Decision

### 1. CPU is the invariant default; GPU is opt-in

- Ollama: `ollamaCpuOnly` defaults to `true` in the Zod schema, in
  `DEFAULT_SETTINGS`, and in the harness view state.
- In-browser (`local`): WASM is the default device; WebGPU is a deliberate
  user choice surfaced in the settings panel.

A user who wants GPU acceleration turns it on and takes responsibility for
whether their device supports it. The default path must work on hardware that
has no GPU at all. Existing users are unaffected: a persisted
`ollamaCpuOnly: false` is read back verbatim, so the flip only reaches new
installations.

### 2. Jev uses a chat-shim over `/v1/systemone`

Jev returns typed decisions with probabilities, not generated text, and exposes
no chat-completions endpoint. Rather than fork the chat UI, the adapter:

1. joins the chat message array into a single `state` string;
2. asks one `choice` question whose criteria are "answer helpfully" and
   "ask a clarifying question";
3. flattens the chosen answer, its confidence, and its per-option
   probabilities back into `ChatResult.content`.

This keeps one rendering path in the UI at the cost of Jev's output being
markdown-ish rather than prose. `sendStream` issues one request and emits one
chunk because the endpoint is not streamable.

### 3. `jevBaseUrl` is allowlisted, not open

`validateJevBaseUrl` accepts only the known cloud hosts
(`api.typesafe.ai`, `openrouter.ai`) plus `localhost` and `.local` hostnames —
the same SSRF guard `validateOllamaUrl` applies. Self-hosting Von is a
first-class path; pointing the provider at an arbitrary origin is not.

### 4. Every persisted provider id must be in the `migrateProvider` allowlist

`migrateProvider` is a hardcoded allowlist, not a membership test against
`ProviderId`. A new provider that is not added there is silently rewritten to
`'openrouter'` on every settings load — the selection looks saved but never
sticks. This is invisible in the UI, so it is treated as a required seam rather
than an optional cleanup.

## Consequences

### Positive

- A default installation works on CPU-only hardware.
- Von gives a private, fee-free decision model behind the same adapter as the
  hosted Jev API.
- The SSRF surface does not grow with the new provider.
- A new `ProviderId` is now caught by the compiler (exhaustive `Record` and
  `switch` sites) and by a test that pins the migration allowlist.

### Negative

- Users with a working GPU must opt in on each new installation.
- Jev answers are structured, not conversational; the harness will not produce
  flowing prose through this provider.
- Jev is not a calculator, and its accuracy on free-text dates is poor — it is a
  decision model, not a general assistant.

### Neutral

- `localDevice` gains persistence it never had; pre-existing sessions default to
  WASM, which is what `LOCAL_DEFAULT_DEVICE` already selected in the adapter.
- Every field added to `AISettings` must be threaded through the schema, the
  defaults, `applyStoredSettings`, `saveAISettings`, the view state, the save
  effect dependency array, and the panel props — a wide, mechanical seam.

## Migration

No stored-setting migration is required. Existing records omit `jevBaseUrl` and
`localDevice` and fall back to `DEFAULT_SETTINGS`; `StoredSettingsSchema`
backfills `ollamaCpuOnly: true` and `localDevice: 'wasm'` only where the field
is absent, so an explicit stored `false` is preserved.
