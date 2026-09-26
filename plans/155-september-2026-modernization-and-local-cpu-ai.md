# Plan 155 — September 2026 Modernization and Local CPU-First AI

**Date**: 2026-09-26
**Status**: Implemented
**Related**: ADR 040, ADR 025, Plan 065

## Goal

Add a Jev / Von System One decision-model provider to the AI Harness, make
CPU the invariant default across every local inference path, and close the
persistence gaps that left existing settings unreachable from the UI.

## Correction to the original plan

`SEPTEMBER_2026_MODERNIZATION_PLAN.md` specified a Jev adapter that called
`POST /v1/chat/completions` with `{ model, messages }`. **Jev has no
chat-completions surface** — that request returns HTTP 400. Three further
errors in the same document:

| Original | Corrected | Why |
|---|---|---|
| `POST /v1/chat/completions` | `POST /v1/systemone` with `{ model, state, questions }` | Jev is a decision API; there is no chat surface |
| model alias `jev-1.13` | `jev-1.13.0` | The short alias is invalid (HTTP 400) |
| `von-1.1` listed beside cloud models | `von-1.2`, reachable only via a local base URL | Von is a self-hosted *server*, not a model on `api.typesafe.ai` |
| no `migrateProvider` change | `'jev'` added to the preserved set | Omitting it silently rewrites a persisted `provider: 'jev'` to `'openrouter'` on every load |

The `migrateProvider` omission was the highest-risk item: the provider would
have appeared in the dropdown, persisted correctly, and then been swapped back
to OpenRouter on the next page load, with no error surfaced anywhere.

## Verified API baseline (September 2026)

### TypeSafe Jev (cloud)

- **Endpoint**: `POST /v1/systemone`
- **Request**: `{ model, state, questions }` — `state` is a single string
  describing the situation; `questions` maps a question id to a typed question
  (`choice`, `noul`, `score`) with `criteria` or `boundaries`.
- **Response**: `{ model, answers, usage }` — `answers` maps the question id to
  the selected value plus `probabilities` and `confidence`.
- **Models**: `jev-1.13.0` (current, versioned), `jev-latest` and `jev-preview`
  (moving aliases). Pin the versioned id; aliases drift between releases.
- **Pricing**: $0.042 per million input tokens; output is free.
- **Rate limits**: 250K tokens/sec, 1200 requests/min.

### Von (open source, self-hosted)

- **Version**: Von 1.2, Apache 2.0.
- **Model**: 395M-parameter ModernBERT-Large.
- **Protocol**: serves the same `/v1/systemone` endpoint, so one adapter covers
  both the cloud API and a local Von server.
- **Latency**: 25–300 ms on CPU; sub-18 ms with a GPU.
- **Start**: `von serve --port 8000`, then point `jevBaseUrl` at
  `http://localhost:8000`.

### Quality

JevBench v1.3 on the Jabr v2 49-task suite: Jev 74.4 composite, Von 72.0
accuracy — Von is close enough to the hosted model to be a credible private
alternative.

### Known failure modes

- Jev is **not a calculator**: it returns typed decisions, not computed values.
- Dates are unreliable when carried as free text — pass them as structured
  criteria, not prose.
- Small models are sensitive to **option order** in `choice` criteria.
- **Cardinality ceiling of 255** options per question.

### Batching

Send every question that shares the same `state` in **one** request. Splitting
them costs roughly 12× more and runs roughly 10× slower, because each call
re-pays for state ingestion.

## Implementation

### Provider seam

`src/lib/ai/types.ts` — `ProviderId` gains `'jev'`; `JEV_PROVIDER_ID`,
`JEV_DEFAULT_MODELS`, `DEFAULT_JEV_BASE_URL`, a `PROVIDER_LABELS` entry, a
`DEFAULT_MODEL` entry, and `ChatRequest.jevBaseUrl`.

`src/lib/ai/url-guard.ts` — `validateJevBaseUrl` mirrors `validateOllamaUrl`
but allows the known cloud hosts (`api.typesafe.ai`, `openrouter.ai`) in
addition to localhost/`.local`, so a self-hosted Von server is reachable
without opening an SSRF path to arbitrary origins.

`src/lib/ai/jev-adapter.ts` — the adapter implements the chat-shim: messages
are joined into `state`, one `choice` question is asked, and the chosen answer
plus its probabilities are flattened into `ChatResult.content` so the chat UI
needs no provider-specific branch. Errors are mapped per status code
(400/401/402/403/422/429) with the raw body slice appended, and the `default`
branch degrades to `Jev error <status>` for codes added after this plan.

`/v1/systemone` is not a streaming endpoint, so `sendStream` performs one
request and emits a single chunk.

### Module layout

The Jev adapter and the two base-URL guards are separate modules rather than
inline blocks in `providers.ts`, which would exceed the 500-LOC hard rule:

- `src/lib/ai/url-guard.ts` — `validateOllamaUrl` and `validateJevBaseUrl`.
  Both are SSRF sinks, so they live together and share one protocol check.
- `src/lib/ai/jev-adapter.ts` — the adapter, its answer renderer, and the
  status-code error mapping. Mirrors the existing `local-adapter.ts` split.
- `src/lib/ai/providers.ts` keeps only the registry and the OpenRouter/Ollama
  adapters.

### Defect found and fixed during verification: autosave vs. URL validation

The settings panel autosaves on every keystroke, and `StoredSettingsSchema`
rejects a base URL that does not parse. Typing `http://localhost:8000` one
character at a time therefore fired a failing save on most keystrokes
(`htt`, `ht`, `http:`, …): the schema rejected each partial host, the stored
record kept the last good value, and the field appeared to edit while silently
discarding the change. 164 `Failed to save AI settings: Invalid AI settings
schema` errors accumulated in one typing session.

This was **pre-existing** — the Ollama base URL field behaved identically
before this plan — but the new Jev field would have shipped with it.

`BaseUrlInput` (`ai-harness-settings-panel.tsx`) fixes both fields: it keeps a
local draft, validates on blur (or Enter), and only then commits the
normalized URL. A rejected value leaves the stored record untouched and sets
`aria-invalid` on the field. Verified in the browser: a valid URL persists
across reload, and a half-typed host leaves storage unchanged.

### Persistence

`StoredSettingsSchema` gains `jevBaseUrl` (validated through
`validateJevBaseUrl`) and `localDevice`. `AISettings` mirrors both, and
`migrateProvider` preserves `'jev'`.

### CPU-first defaults

- `ollamaCpuOnly` defaults to `true` in the schema, `DEFAULT_SETTINGS`, and the
  harness view — CPU is the invariant default, GPU is opt-in.
- `localDevice` is now persisted and surfaced as a select in the settings panel;
  before this change `ChatRequest.localDevice` was consumed by
  `local-adapter.ts` but had no path from the UI, so the WASM/WebGPU toggle was
  unreachable.

The `ollamaCpuOnly` flip only affects brand-new installations: an existing
`ollamaCpuOnly: false` is read back from storage verbatim, never re-defaulted.

## Verification

- `pnpm run typecheck` — the `Record<ProviderId, …>` and exhaustive-switch
  checks make every missed seam a compile error.
- `pnpm run test` — `getAdapter('jev')`, the `/v1/systemone` request shape,
  the 401/422 error mapping, `validateJevBaseUrl` host policy,
  `migrateProvider` preservation, and the CPU/device schema defaults.
- `pnpm run build` — 0 errors, 0 warnings.
- UI smoke: select the Jev provider in the harness settings and confirm the API
  key field, the three-model dropdown, and the base URL input appear.
