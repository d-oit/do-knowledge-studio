import type { ChatRequest, ChatResult, ProviderAdapter, ProviderId } from './types'
import { t } from '@/lib/i18n/messages/ai'

// The transformers.js package is deliberately absent from the static import
// graph: it is a heavyweight client-only bundle, so it is reached ONLY via
// the dynamic `import('@huggingface/transformers')` inside
// loadTransformersRuntime (SSR-safe, and the only matching grep hit in src/).
// The structural types below mirror exactly the v4 API surface the adapter
// touches, so no type-only import is needed either.

/**
 * Fully-offline, in-browser LLM provider (issue #756, N6).
 *
 * Runs a small quantized instruct model via transformers.js + ONNX Runtime
 * WebAssembly. The library itself is never statically imported — it is a
 * heavyweight client-only bundle, so it is loaded with a lazy dynamic
 * import on the first local send (SSR-safe: local-adapter.ts only ever
 * touches browser-side code inside function bodies).
 *
 * Streaming: the text-generation pipeline supports `streamer` callbacks
 * (word-level deltas via `TextStreamer.on_finalized_text`), so
 * {@link LocalAdapter.sendStream} emits real deltas with `onChunk`.
 * Abort: transformers.js exposes no AbortSignal hook, so an
 * `InterruptableStoppingCriteria` (constructed from the dynamically
 * imported module) is wired to the signal — aborting calls `interrupt()`
 * and generation stops at the next step; a post-generate check throws a
 * DOMException AbortError so the harness treats it exactly like the
 * fetch-backed providers.
 */

/** Default inference device; WebGPU is opt-in via ChatRequest.localDevice. */
export const LOCAL_DEFAULT_DEVICE = 'wasm' as const

/** Quantized dtype used when the selected model is not in DEFAULT_LOCAL_MODELS. */
const LOCAL_FALLBACK_DTYPE = 'q8' as const

/** Cap on generated tokens per reply — keeps browser inference bounded. */
const LOCAL_MAX_NEW_TOKENS = 256

/** DOMException name used for signal-driven cancellation. */
const ABORT_ERROR_NAME = 'AbortError'

/** A selectable in-browser model with a human-readable name. */
export interface LocalModelOption {
  readonly id: string
  readonly displayName: string
  readonly dtype: 'q4' | 'q8'
  readonly description?: string
}

/**
 * Small quantized instruct models suited to browser memory (WASM).
 * Model ids verified on the Hugging Face Hub (transformers.js ONNX exports).
 */
export const DEFAULT_LOCAL_MODELS: LocalModelOption[] = [
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    displayName: 'Qwen2.5 0.5B Instruct',
    dtype: 'q4',
    description: 'Balanced quality for browser-sized memory (~250 MB download).',
  },
  {
    id: 'onnx-community/SmolLM2-135M-Instruct-ONNX-GQA',
    displayName: 'SmolLM2 135M Instruct',
    dtype: 'q8',
    description: 'Smallest and fastest — best for low-memory devices (~140 MB download).',
  },
  {
    id: 'onnx-community/Llama-3.2-1B-Instruct',
    displayName: 'Llama 3.2 1B Instruct',
    dtype: 'q4',
    description: 'Strongest quality; largest download (~580 MB).',
  },
]

/** Chat-mode generation output: every item carries the full turn list. */
type TextGenerationChatOutput = ReadonlyArray<{
  readonly generated_text?: ReadonlyArray<{
    readonly role: string
    readonly content?: string
  }>
}>

/** InterruptableStoppingCriteria instance surface (interrupt() stops generation). */
interface InterruptableStoppingCriteria {
  interrupt(): void
  reset(): void
}

type InterruptCriteriaCtor = new () => InterruptableStoppingCriteria

/** TextStreamer constructor options: word-level deltas via callback_function. */
interface TextStreamerOptions {
  skip_prompt?: boolean
  skip_special_tokens?: boolean
  callback_function?: (text: string) => void
}

type TextStreamerCtor = new (tokenizer: unknown, options: TextStreamerOptions) => unknown

/** Value-side surface needed from the dynamically imported transformers module. */
interface TransformersRuntime {
  readonly generator: {
    readonly tokenizer: unknown
    (texts: unknown, options?: Record<string, unknown>): Promise<TextGenerationChatOutput>
  }
  readonly InterruptableStoppingCriteria: InterruptCriteriaCtor
  readonly TextStreamer: TextStreamerCtor
}

/** Lazily-created transformers.js runtimes, cached per model + device. */
const pipelineCache = new Map<string, Promise<TransformersRuntime>>()

/** Clears the pipeline cache. Used by tests to isolate between test cases. */
export const resetLocalPipelineCache = (): void => {
  pipelineCache.clear()
}

/** Loads (and caches) the transformers.js runtime for a model + device. */
const loadTransformersRuntime = (
  model: string,
  device: 'wasm' | 'webgpu',
  dtype: 'q4' | 'q8',
): Promise<TransformersRuntime> => {
  const key = `${device}:${model}`
  const cached = pipelineCache.get(key)
  if (cached) return cached

  const pending = import('@huggingface/transformers')
    .then(async (mod) => {
      const generator = await mod.pipeline('text-generation', model, { device, dtype })
      const runtime: TransformersRuntime = {
        generator: generator as unknown as TransformersRuntime['generator'],
        // The package's real constructors are structurally richer than this
        // seam (rest-spread options, concrete tokenizer type); cast at the
        // dynamic-import boundary so the cache holds the seam type.
        InterruptableStoppingCriteria:
          mod.InterruptableStoppingCriteria as unknown as InterruptCriteriaCtor,
        TextStreamer: mod.TextStreamer as unknown as TextStreamerCtor,
      }
      return runtime
    })
    .catch((error: unknown) => {
      // Drop the failed entry so a later send retries the load.
      pipelineCache.delete(key)
      if (error instanceof DOMException && error.name === ABORT_ERROR_NAME) throw error
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(t('ai.local.error.loadFailed', model, reason))
    })
  pipelineCache.set(key, pending)
  return pending
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', ABORT_ERROR_NAME)
  }
}

/** Extracts the assistant reply from a chat-mode generation output. */
const extractGeneratedContent = (output: TextGenerationChatOutput): string => {
  const first = output[0]
  const last = first?.generated_text?.at(-1)
  if (!last || typeof last.content !== 'string') return ''
  return last.content
}

/**
 * Runs one generation pass with abort + optional streaming.
 * Returns the full assistant reply; emits word-level deltas via onChunk.
 */
const runGeneration = async (
  runtime: TransformersRuntime,
  messages: Parameters<TransformersRuntime['generator']>[0],
  signal: AbortSignal | undefined,
  onChunk?: (chunk: string) => void,
): Promise<string> => {
  throwIfAborted(signal)

  const criteria = new runtime.InterruptableStoppingCriteria()
  const onAbort = (): void => { criteria.interrupt() }
  signal?.addEventListener('abort', onAbort, { once: true })

  let streamed = ''
  try {
    const output = await runtime.generator(messages, {
      max_new_tokens: LOCAL_MAX_NEW_TOKENS,
      return_full_text: false,
      stopping_criteria: criteria,
      ...(onChunk
        ? {
            streamer: new runtime.TextStreamer(runtime.generator.tokenizer, {
              skip_prompt: true,
              skip_special_tokens: true,
              callback_function: (text: string) => {
                streamed += text
                onChunk(text)
              },
            }),
          }
        : {}),
    })
    throwIfAborted(signal)

    const full = extractGeneratedContent(output)
    if (streamed) return streamed
    if (full) return full
    throw new Error(t('ai.local.error.empty'))
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Adapter that runs a quantized instruct model locally in the browser. */
class LocalAdapter implements ProviderAdapter {
  readonly id: ProviderId = 'local'
  readonly requiresKey = false

  private static resolveTarget(
    request: ChatRequest,
  ): { model: string; dtype: 'q4' | 'q8'; device: 'wasm' | 'webgpu' } {
    const model = typeof request.model === 'string' ? request.model : request.model.slug
    const option = DEFAULT_LOCAL_MODELS.find((m) => m.id === model)
    const device = request.localDevice ?? LOCAL_DEFAULT_DEVICE
    return { model, dtype: option?.dtype ?? LOCAL_FALLBACK_DTYPE, device }
  }

  async send(request: ChatRequest): Promise<ChatResult> {
    const { model, dtype, device } = LocalAdapter.resolveTarget(request)
    const runtime = await loadTransformersRuntime(model, device, dtype)
    const content = await runGeneration(runtime, request.messages, request.signal)
    return { content, provider: 'local', model }
  }

  async sendStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    const { model, dtype, device } = LocalAdapter.resolveTarget(request)
    const runtime = await loadTransformersRuntime(model, device, dtype)
    const content = await runGeneration(runtime, request.messages, request.signal, onChunk)
    return { content, provider: 'local', model }
  }
}

/** Shared LocalAdapter instance registered in the adapters record. */
export const localAdapter: ProviderAdapter = new LocalAdapter()