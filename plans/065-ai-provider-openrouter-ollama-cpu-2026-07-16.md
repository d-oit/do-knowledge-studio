# Plan 065 — AI Provider Consolidation: OpenRouter + Ollama CPU-Only

**Date**: 2026-07-16  
**Status**: Analysis / proposal  
**Related**: ADR 019, ADR 06 (legacy `src/lib/llm`), plan 041, plan 049 T1/T2  

## Executive summary

The AI Harness currently talks to **three separate vendor APIs** (OpenAI, Anthropic, Ollama) via inline `fetch` in the view. That is fragile, duplicates request shapes, and blocks free/multi-model cloud use. Research confirms:

1. **OpenRouter** is a single OpenAI-compatible gateway (`https://openrouter.ai/api/v1/chat/completions`) that can replace direct OpenAI + Anthropic (and hundreds of other models, including free routers like `openrouter/free`).
2. **Ollama** should stay as the local-first path; add an explicit **CPU-only** option via request `options.num_gpu: 0` (and document host-level GPU disable for full isolation).
3. **Web research** for the product (in-app) is advertised in UI copy but not implemented; agent-side research already exists via `do-web-doc-resolver` / cascade plans — wire a thin, local-first research step into the harness.

## Current codebase state

| Area | Location | Reality |
|------|----------|---------|
| Provider type | `src/lib/studio/ai-settings.ts` | `'openai' \| 'anthropic' \| 'ollama'` |
| Endpoints | `getProviderEndpoint()` | Direct vendor URLs only |
| Chat calls | `ai-harness-view.tsx` → `fetchProvider()` | ~50 LOC inline; no AbortController, no streaming |
| Settings | AES-GCM + localStorage | Works; session-scoped crypto key (lost on tab close → key decrypt fails until re-entry) |
| Local RAG | Same view | Naïve first-20 entities, not BM25 from `src/lib/search/retrieval.ts` |
| Chat view | `chat-view.tsx` + store | Local retrieval only; **not** LLM-backed |
| Documented `src/lib/ai` | AGENTS.md | **Missing** — path does not exist |
| Legacy plan | ADR 06 / plan 041 | Older Vite app had OpenRouter + Kilo + streaming; **not** ported to Next.js tree |

### Critical gaps vs product copy

- Welcome message promises: *“paste URLs to have me fetch and analyze external content”* — **no URL fetch**.
- Error path still says *“demo fallback”* even when a real provider failed.
- Anthropic path uses a **different** request schema (`/v1/messages`, `x-api-key`) than OpenAI/Ollama — higher maintenance and CORS risk in the browser.
- No OpenRouter, no free-model router, no CPU-only Ollama toggle.

## Web research findings

### OpenRouter (replace separate cloud APIs)

- **Endpoint**: `POST https://openrouter.ai/api/v1/chat/completions` (OpenAI-compatible).
- **Auth**: `Authorization: Bearer <OPENROUTER_API_KEY>`.
- **Optional attribution**: `HTTP-Referer`, `X-OpenRouter-Title` (or `X-Title` in older docs).
- **Models**: any slug from [openrouter.ai/models](https://openrouter.ai/models); free router `openrouter/free` auto-picks free models; many `:free` variants (e.g. Nemotron, Hy3, Laguna).
- **Implication for this app**: one adapter + one API key replaces OpenAI + Anthropic (+ Gemini/Grok/etc. later) without per-vendor SDKs — aligns with ADR 019 (“typed fetch adapter”, no backend).

**Recommended default cloud models (curated list, not exhaustive):**

| Slug | Role |
|------|------|
| `openrouter/free` | Zero-cost default |
| `anthropic/claude-sonnet-4` (or current alias) | Quality reasoning |
| `openai/gpt-4o-mini` | Cheap / fast |
| `meta-llama/llama-3.3-70b-instruct:free` (if listed) | Free quality |

### Ollama CPU-only

Documented / community-supported levers:

| Level | Mechanism | Use in app? |
|-------|-----------|-------------|
| **Per request** | `options: { num_gpu: 0 }` on `/api/chat` | **Yes** — UI toggle “CPU only” |
| **Host env (NVIDIA)** | `CUDA_VISIBLE_DEVICES=-1` before starting Ollama | Document only (user machine) |
| **Host env (AMD)** | `ROCR_VISIBLE_DEVICES=-1` | Document only |
| **Docker** | CPU image / no `--gpus` | Document only |

Ollama OpenAPI marks `options` as open (`additionalProperties: true`), so `num_gpu` is valid even if not listed as a named property in the schema snapshot.

**Why expose CPU-only in the UI**

- Shared machines where VRAM is reserved for games/CUDA work.
- Laptops without discrete GPU / driver issues.
- Deterministic “won’t touch GPU” preference for long-running background agents.

Trade-off: much slower inference; UI should label it clearly.

### Web research (in-product)

Agent harness already has research skills/plans (`do-web-doc-resolver`, free-first cascade). Product UI does not. Client-side options that stay local-first:

1. **URL paste → Jina Reader / `r.jina.ai/<url>`** (no key, CORS-friendly) for page text injection — matches plan 041’s old behavior.
2. **Optional BYO research API** (Tavily/Exa) via OpenRouter or separate key later — not required for v1.
3. **Reuse retrieval** for local KB before any external call.

## Target architecture

```
src/lib/ai/
  types.ts          # ChatMessage, ChatRequest, ChatResult, ProviderId
  providers.ts      # openrouter + ollama adapters (OpenAI-compatible shape)
  context.ts        # build system prompt + BM25 local context
  research.ts       # optional URL → markdown (Jina) with AbortController
  index.ts          # barrel

src/lib/studio/ai-settings.ts
  AIProvider = 'openrouter' | 'ollama'
  + ollamaCpuOnly: boolean
  + ollamaBaseUrl?: string  (optional advanced)

ai-harness-view.tsx
  thin UI only; calls lib/ai
```

### Provider model

| Provider | Endpoint | Key | Notes |
|----------|----------|-----|-------|
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | Required | Models: free router + curated list; custom model string allowed |
| `ollama` | `http://localhost:11434/api/chat` (or OpenAI-compat `/v1/chat/completions`) | None | `options.num_gpu: 0` when CPU-only |

**Remove as first-class providers**: direct `openai`, direct `anthropic` (reachable *through* OpenRouter model slugs instead).

Migration of stored settings:

```ts
// on loadAISettings
if (stored.provider === 'openai' || stored.provider === 'anthropic') {
  provider = 'openrouter'
  // map models to openrouter-prefixed slugs where possible
}
```

## Implementation tasks

### P0 — Correctness & consolidation

| ID | Task | Files |
|----|------|-------|
| A1 | Introduce `src/lib/ai/providers.ts` with OpenRouter + Ollama adapters; AbortController on all fetch | new `src/lib/ai/*` |
| A2 | Change `AIProvider` to `'openrouter' \| 'ollama'`; migrate old providers on load | `ai-settings.ts` + tests |
| A3 | Add `ollamaCpuOnly: boolean` (default `false`); pass `options: { num_gpu: 0 }` when true | settings + providers + UI |
| A4 | Wire harness `handleSend` to lib/ai; remove inline `fetchProvider` | `ai-harness-view.tsx` |
| A5 | Fix UX copy: no “demo fallback”; no URL promise until research lands | view strings → constants |

### P1 — Quality

| ID | Task |
|----|------|
| B1 | Local augment via BM25 (`retrieval.ts`) top-k, not first 20 entities |
| B2 | Streaming for OpenRouter (SSE) and Ollama (`stream: true` NDJSON) |
| B3 | Custom model text input + “Refresh Ollama models” (`GET /api/tags`) |
| B4 | Optional `ollamaBaseUrl` for remote Ollama (still user-controlled, local-first) |
| B5 | Persist encryption key more carefully **or** document session-bound encrypt (current sessionStorage key is weak across reloads) |

### P2 — Web research in harness

| ID | Task |
|----|------|
| C1 | Detect URLs in user message; fetch via Jina Reader with timeout + AbortController |
| C2 | Toggle “Allow web research” (default off — privacy-first) |
| C3 | Cite fetched URLs in assistant context block; never store keys for free path |
| C4 | ADR update: supersede dual-vendor path with OpenRouter + Ollama |

## Settings schema (proposed)

```ts
export type AIProvider = 'openrouter' | 'ollama'

export interface AISettings {
  provider: AIProvider
  model: string
  apiKey: string              // OpenRouter only
  augmentWithLocal: boolean
  ollamaCpuOnly: boolean     // Ollama only
  allowWebResearch: boolean  // default false
  ollamaBaseUrl: string      // default http://localhost:11434
}
```

## Ollama request shape (CPU-only)

```json
{
  "model": "llama3",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": false,
  "options": {
    "num_gpu": 0
  }
}
```

Host-level (docs only, not app code):

```bash
# NVIDIA — force Ollama process onto CPU
CUDA_VISIBLE_DEVICES=-1 ollama serve
```

## OpenRouter request shape

```json
{
  "model": "openrouter/free",
  "messages": [{ "role": "user", "content": "..." }]
}
```

Headers: `Authorization`, `Content-Type`, optional `HTTP-Referer` / `X-OpenRouter-Title` set to product name for rankings.

## Risks & constraints

| Risk | Mitigation |
|------|------------|
| Browser CORS to OpenRouter | OpenRouter supports browser use; if blocked, document extension/proxy — **do not** add required backend |
| Anthropic-only features lost | Use OpenRouter model slugs; tool use later via OpenAI-compatible tools |
| CPU-only ignored on old Ollama | Graceful ignore; surface version tip if still on GPU |
| Free model rate limits | Show clear 429 toast; suggest paid OpenRouter or local Ollama |
| Privacy / web research | Off by default; only fetch when toggle on and URL present |
| AGENTS.md `src/lib/ai` | Create folder to match documented layout |

## Success criteria

- [ ] Single cloud key path: OpenRouter only (no separate OpenAI/Anthropic endpoints in app code)
- [ ] Ollama still default local provider
- [ ] CPU-only toggle persists and sets `num_gpu: 0`
- [ ] Unit tests for endpoint selection, migration, and Ollama options payload
- [ ] No empty catch; AbortController on fetch
- [ ] Named exports; strings in constants
- [ ] ADR 019 updated or ADR 025 written
- [ ] Quality gate green after implementation

## Effort estimate

| Wave | Scope | Effort |
|------|-------|--------|
| 1 | A1–A5 + tests | 4–6 h |
| 2 | B1–B3 | 4–6 h |
| 3 | C1–C4 + ADR | 3–5 h |

## Decisions

1. **Drop direct OpenAI/Anthropic UI entirely?** → Yes — OpenRouter only for cloud.
2. **Default model for OpenRouter?** → `openrouter/free` (zero-cost, auto-picks free models).
3. **Ship web research in same PR as provider consolidation or follow-up?** → Follow-up (PR #462).
4. **CPU-only default?** → `false` — opt-in toggle.
5. **Default provider for new users?** → `openrouter` with `openrouter/free` model (changed 2026-07-16). Users without an API key see a clear error prompt instead of silently failing against Ollama.

---

*Analysis based on current tree (`ai-settings.ts`, `ai-harness-view.tsx`), ADR 019, and web research of OpenRouter quickstart + Ollama chat API / GPU docs (2026-07).*
