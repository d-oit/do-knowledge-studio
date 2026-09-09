# N6 — Fully-offline local LLM via transformers.js (issue #756)

## Goal

Let users pick a "Local (in-browser)" provider in the AI Harness that runs a
small quantized instruct model entirely in the browser via
[@huggingface/transformers](https://www.npmjs.com/package/@huggingface/transformers) 4.2.0
+ ONNX Runtime WebAssembly. No API key, no server: first use downloads the
model from the Hugging Face Hub (needs network once), afterwards it runs
offline and the model stays in the browser. `package.json` already pins
`@huggingface/transformers@4.2.0` (verified in `node_modules`).

## Implementation

- `src/lib/ai/types.ts`: added `'local'` to `ProviderId`, `LOCAL_PROVIDER_ID`,
  `PROVIDER_LABELS.local`, `DEFAULT_MODEL.local`, and an optional
  `ChatRequest.localDevice?: 'wasm' | 'webgpu'`.
- `src/lib/ai/local-adapter.ts` (new): `LocalAdapter` registered in the
  `adapters` record with `requiresKey: false`.

### Model list (`DEFAULT_LOCAL_MODELS`)

Verified transformers.js ONNX exports on the Hugging Face Hub:

| Model id | Dtype | Notes |
|---|---|---|
| `onnx-community/Qwen2.5-0.5B-Instruct` (default) | `q4` | ~250 MB download; balanced quality |
| `onnx-community/SmolLM2-135M-Instruct-ONNX-GQA` | `q8` | ~140 MB; smallest/fastest |
| `onnx-community/Llama-3.2-1B-Instruct` | `q4` | ~580 MB; best quality |

Unknown/custom model slugs fall back to `q8` (the README's WASM default).

### Key mechanics (verified against node_modules source/typings)

- **Lazy load, cached**: `@huggingface/transformers` is imported only through
  `import('@huggingface/transformers')` inside the adapter (SSR-safe — no
  static import, no browser globals at module scope). The resolved pipeline
  object is cached per `device:model` key; failed loads drop the cache entry
  so a later send retries.
- **Streaming**: v4 `TextGenerationPipeline` accepts a `streamer` option
  (`TextStreamer` with `callback_function`); the adapter emits word-level
  deltas to `onChunk` and returns the concatenated stream. If no deltas were
  produced (defensive), the final chat output text is emitted once. Verified:
  `model.generate({ ..., streamer })` calls `streamer.put/end` and the
  pipeline spreads `streamer`/`stopping_criteria` straight into `generate`.
- **Abort**: transformers.js has no AbortSignal hook, so `runGeneration`
  constructs an `InterruptableStoppingCriteria` from the dynamically imported
  module, wires `signal.addEventListener('abort') → criteria.interrupt()`
  (removed in `finally`), and re-checks `signal.aborted` after `generate`
  resolves — throwing a `DOMException('AbortError')` identical to the
  fetch-backed providers so the harness silently ignores aborts.
- **Errors surface in the harness**: load failures (offline first use, wasm
  fetch failure, runtime errors) are wrapped in a descriptive message linked
  to the model and reason; empty replies get their own message. The harness
  renders `[Error] …` in chat, so the settings panel/chat never hangs.
- **Chat template**: the pipeline applies the model's chat template when
  passed an array of `{ role, content }` messages; the assistant reply is
  read from `output[0].generated_text.at(-1).content` (with `return_full_text:
  false`).
- **Device**: `'wasm'` default; `'webgpu'` is supported via
  `ChatRequest.localDevice` but is not wired to a settings toggle yet.

### Settings UI

- `PROVIDERS` gains a `local` entry (label from
  `src/lib/i18n/messages/ai.ts`), `requiresKey: false` — the API key field
  hides automatically.
- The engine select lists `DEFAULT_LOCAL_MODELS` display names; switching the
  provider sets `DEFAULT_MODEL.local`; the download-on-first-use hint renders
  under the engine field.
- `ai-settings.ts` `migrateProvider` now preserves `'local'` on load;
  `getProviderEndpoint('local')` returns `''`.

### Persistence

`StoredSettingsSchema.provider` is a plain `z.string()` (not a union), so no
schema change was needed; `saveAISettings`/`loadAISettings` round-trip
`'local'` (covered by new tests).

## i18n

New user-facing strings live in `src/lib/i18n/messages/ai.ts` (per-scope
`makeT` module): the local provider label, the download hint, and the
adapter's load-failure/empty-response messages. Model display names stay in
`DEFAULT_LOCAL_MODELS` as product names (same convention as OpenRouter
targets).

## Tests

- `src/lib/ai/local-adapter.test.ts` (new): mocks `@huggingface/transformers`
  (`vi.mock`) — lazy load once, per-model caching, send content, `requiresKey:
  false`, adapter registration, pre-abort + mid-generation abort (AbortError),
  empty-response error, descriptive load-failure error, retry-after-failure,
  chunked streaming + no-delta fallback, unknown-model `q8` fallback. No model
  is downloaded.
- `providers.test.ts` / `types-coverage.test.ts`: provider-inventory coverage
  for `local`.
- `ai-settings.test.ts`: `local` round-trip + localStorage migration + empty
  endpoint.
- `ai-harness-settings.test.tsx` / `ai-harness-settings-panel.test.tsx`:
  provider inventory + key-field hiding + download hint + default model on
  switch (view-test mocks extended with the new exports).
- `e2e/local-llm.spec.ts` (new, network-free): asserts the local provider
  option exists, selecting it hides the API key field, and local models render
  in the engine selector. No chat is sent, so no model download occurs.

## Follow-ups / risks

- `env.backends.onnx.wasm.wasmPaths` defaults to the jsDelivr CDN (per the
  v4 README, "precompiled WASM binaries … work out-of-the-box"). If the
  Turbopack/Next build surfaces `import.meta.url`/wasm resolution issues, set
  `wasmPaths` explicitly at load time in `loadTransformersRuntime`.
- A settings toggle for WebGPU (`request.localDevice`) and model-download
  progress reporting are natural follow-ups; the adapter throws descriptive
  errors (never hangs) in the meantime.
- First download can be large (q4 ≈ 250–580 MB); the UI copy documents that
  this happens once and then runs offline.