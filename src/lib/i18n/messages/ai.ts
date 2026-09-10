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
  'ai.settings.local.downloadHint':
    'First use downloads the model from the Hugging Face Hub (needs a network connection once). Afterwards it runs fully offline — the model stays in your browser.',
  'ai.local.error.loadFailed': (model: string, reason: string) =>
    `The offline model "${model}" could not be loaded. The first use downloads it from the Hugging Face Hub (needs a network connection once); afterwards it runs fully offline. If you were offline, connect once to download the model, then retry. Reason: ${reason}`,
  'ai.local.error.empty': 'The local model returned an empty response.',
} as const

export const translate = makeT(messages)