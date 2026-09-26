import { makeT } from '@/lib/i18n/t'

/**
 * AI Harness / in-browser local LLM (N6) message scope.
 *
 * New user-facing strings for the 'local' (transformers.js) provider live
 * here (AGENTS.md: never hardcode user-facing strings). The canonical
 * machine-facing provider label constant in `@/lib/ai/types` mirrors
 * `ai.settings.provider.local.label` for programmatic consumers.
 */
const messages = {
  'ai.settings.provider.local.label': 'Local (in-browser)',
  'ai.settings.provider.jev.label': 'TypeSafe Jev / Von (Decision API)',
  'ai.settings.jev.hint':
    'TypeSafe Jev is a cloud System One decision API ($0.042/M input tokens, free output). For private, fee-free local CPU decision modeling, run open-source Von 1.2 (von serve --port 8000) and point the base URL to localhost.',
  'ai.settings.jev.baseUrl.label': 'Jev API Base URL',
  'ai.settings.jev.baseUrl.placeholder': 'https://api.typesafe.ai',
  'ai.settings.jev.baseUrl.invalid':
    'Enter a known cloud host (api.typesafe.ai), a localhost Von server, or a .local hostname.',
  'ai.settings.ollama.baseUrl.invalid': 'Enter a localhost or .local hostname.',
  'ai.settings.apiKey.stored': (provider: string) =>
    `Stored in this browser only — sent directly to ${provider}.`,
  'ai.settings.local.device.label': 'Inference device',
  'ai.settings.local.device.cpu': 'CPU (WASM) — Default',
  'ai.settings.local.device.gpu': 'WebGPU (GPU acceleration — Optional)',
  'ai.settings.local.device.description':
    'Runs on CPU by default. Enable WebGPU only if your device and browser support GPU compute shaders.',
  'ai.settings.local.downloadHint':
    'First use downloads the model from the Hugging Face Hub (needs a network connection once). Afterwards it runs fully offline — the model stays in your browser.',
  'ai.local.error.loadFailed': (model: string, reason: string) =>
    `The offline model "${model}" could not be loaded. The first use downloads it from the Hugging Face Hub (needs a network connection once); afterwards it runs fully offline. If you were offline, connect once to download the model, then retry. Reason: ${reason}`,
  'ai.local.error.empty': 'The local model returned an empty response.',
  'ai.jev.error.badRequest': (detail: string) =>
    `Jev error 400: malformed request — verify the model id is exact (e.g. jev-1.13.0, not jev-1.13). ${detail}`,
  'ai.jev.error.unauthorized': 'Jev error 401: invalid or revoked API key',
  'ai.jev.error.credits': 'Jev error 402: insufficient credits',
  'ai.jev.error.inactive': 'Jev error 403: account inactive',
  'ai.jev.error.missingField': (detail: string) =>
    `Jev error 422: missing required field (model and state are required). ${detail}`,
  'ai.jev.error.rateLimited': 'Jev error 429: rate limit or credits exhausted',
  'ai.jev.error.upstream': (status: string, detail: string) => `Jev error ${status}: ${detail}`,
  'ai.jev.error.missingKey': 'A Jev API key is required',
  'ai.jev.error.empty': 'Jev returned no usable answer',
  'ai.jev.error.malformed': 'Jev returned a malformed response',
} as const

export const translate = makeT(messages)