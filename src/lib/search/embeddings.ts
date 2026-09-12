/**
 * In-browser multilingual sentence embeddings (N1, Issue #751).
 *
 * Lazy singleton runtime around @huggingface/transformers v4 (transformers.js).
 * The model — Xenova/paraphrase-multilingual-MiniLM-L12-v2 — is the
 * sentence-transformers model used by the official transformers.js semantic
 * search demos; it embeds 13 languages and needs no query/passage prefix
 * ceremony (unlike E5 models). Embeddings are mean-pooled and L2-normalized
 * here at write time so downstream cosine ranking is a plain dot product.
 *
 * CLIENT-ONLY: the package is reached through a dynamic import inside
 * `getEmbedder()`, so no SSR-reachable code statically depends on it and the
 * ~25 MB quantized model downloads only on the first `embedTexts` call.
 *
 * Failure contract: every public call either returns vectors or throws a
 * descriptive `EmbedderError` (or an `AbortError` when the signal fires), so
 * callers can degrade to lexical BM25 search with a surfaced state instead of
 * silently returning keyword results. A failed load resets the cached promise,
 * so the next call retries the download instead of failing forever.
 */

/**
 * Minimal structural view of a transformers.js embedding tensor. The real
 * package type is only reachable through the dynamic import in
 * `loadEmbedder()`; declaring the consumed surface here keeps this module
 * free of any static `@huggingface/transformers` import (SSR-safe, and the
 * acceptance grep for static imports stays clean).
 */
export interface EmbeddingTensor {
  dims: number[]
  tolist(): unknown
}

/**
 * Minimal callable shape of the feature-extraction pipeline this module
 * consumes: batch texts in, mean-pooled tensor out.
 */
export type EmbeddingPipeline = (
  texts: string[],
  options: { pooling: 'mean' },
) => Promise<EmbeddingTensor>

/** Model id exported from a quantized ONNX (transformers.js) conversion. */
export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'

/** 8-bit quantized weights — the transformers.js default for WASM execution. */
export const EMBEDDING_DTYPE = 'q8' as const
/** CPU execution via WASM — no WebGPU required, works in every modern browser. */
export const EMBEDDING_DEVICE = 'wasm' as const

/**
 * Character cap applied to each document before embedding. Bounds tokenizer
 * cost for very long notes while staying at or near the model's native 512
 * token truncation for Latin scripts (a token ≈ 4 chars); CJK headers are
 * what matter most in a knowledge base, so head-truncation is the right shape.
 */
export const EMBED_MAX_CHARS = 512
/** Batch size for embedding many documents in one inference call. */
export const EMBED_BATCH_SIZE = 32

/** Mean pooling across token hidden states (sentence-transformers default). */
export const EMBED_POOLING = 'mean' as const

/** Descriptive error thrown by every public embedding failure path. */
export class EmbedderError extends Error {
  override name = 'EmbedderError'
}

/** Abort error thrown when the caller aborts an embedding request. */
const abortError = (): Error => new DOMException('Embedding aborted', 'AbortError')

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError'

/**
 * Resolves with the awaitable's result unless `signal` fires first, in which
 * case it rejects with AbortError and cleans up its listener. Used to keep
 * long model loads and inference responsive to cancellation.
 */
const raceWithAbort = async <T>(awaitable: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal || signal.aborted) {
    if (signal?.aborted) throw abortError()
    return awaitable
  }
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  const onAbort = (): void => reject(abortError())
  signal.addEventListener('abort', onAbort)
  awaitable.then(
    (value) => resolve(value),
    (err) => reject(err),
  )
  try {
    return await promise
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/** Lifecycle of the lazily-loaded embedding runtime. */
export type EmbedderStatus = 'idle' | 'loading' | 'ready' | 'error'

let embedderPromise: Promise<EmbeddingPipeline> | null = null
let embedderStatus: EmbedderStatus = 'idle'
let embedderFailure: string | null = null
/**
 * Incremented by {@link disposeEmbedder} so an in-flight load from before the
 * dispose can detect that its runtime is obsolete and must not write state
 * (status/failure/singleton) that belongs to a newer load.
 */
let embedderGeneration = 0

/** Loads the transformers.js pipeline; resolves once and caches itself. */
const loadEmbedder = async (generation: number): Promise<EmbeddingPipeline> => {
  embedderStatus = 'loading'
  try {
    const { pipeline } = await import('@huggingface/transformers')
    const extractor = (await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      dtype: EMBEDDING_DTYPE,
      device: EMBEDDING_DEVICE,
    })) as EmbeddingPipeline
    if (generation === embedderGeneration) {
      embedderStatus = 'ready'
      embedderFailure = null
    }
    return extractor
  } catch (err) {
    if (generation === embedderGeneration) {
      embedderStatus = 'error'
      embedderFailure = err instanceof Error ? err.message : String(err)
      // Drop the rejected promise so the next call retries the model download.
      embedderPromise = null
    }
    throw new EmbedderError(
      `Semantic embedding model failed to load (${EMBEDDING_MODEL_ID}): ${
        embedderFailure ?? (err instanceof Error ? err.message : String(err))
      }`,
      { cause: err },
    )
  }
}

/**
 * Returns the cached embedding pipeline, loading it on first use.
 * Concurrent callers share the same promise (lazy singleton).
 */
export const getEmbedder = (): Promise<EmbeddingPipeline> => {
  if (embedderPromise === null) {
    embedderPromise = loadEmbedder(embedderGeneration)
  }
  return embedderPromise
}

/** Current lifecycle state of the embedding runtime. */
export const getEmbedderStatus = (): EmbedderStatus => embedderStatus

/** True once the embedding pipeline has loaded successfully. */
export const isEmbedderReady = (): boolean => embedderStatus === 'ready'

/** Why the last load attempt failed, or null when never failed/ready. */
export const getEmbedderError = (): string | null => embedderFailure

/** Resets the singleton so the next call reloads the model (tests, retries). */
export const disposeEmbedder = (): void => {
  embedderGeneration += 1
  embedderPromise = null
  embedderStatus = 'idle'
  embedderFailure = null
}

/** Caps a document to EMBED_MAX_CHARS before embedding. */
export const truncateForEmbedding = (text: string): string =>
  text.length > EMBED_MAX_CHARS ? text.slice(0, EMBED_MAX_CHARS) : text

/** L2-normalizes a vector in place-free fashion (returns a new array). */
export const normalizeEmbedding = (vec: number[]): number[] => {
  let sumSquares = 0
  for (const v of vec) sumSquares += v * v
  const norm = Math.sqrt(sumSquares)
  if (norm === 0) return vec.slice()
  const invNorm = 1 / norm
  return vec.map((v) => v * invNorm)
}

/** Returns a detached, JSON-safe copy of an embedding for persistence. */
export const serializeEmbedding = (vec: number[]): number[] => vec.slice()

/** Validates the pipeline output shape and flattens it to plain rows. */
const toRows = (output: EmbeddingTensor): number[][] => {
  const dims = output.dims
  if (!dims || dims.length !== 2) {
    throw new EmbedderError(
      `Unexpected embedding output shape: ${dims ? `[${dims.join(', ')}]` : 'unknown'}`,
    )
  }
  return output.tolist() as number[][]
}

/** Runs the extractor over prepared texts, mapping failures to EmbedderError. */
const runInference = async (
  extractor: EmbeddingPipeline,
  prepared: string[],
  signal?: AbortSignal,
): Promise<EmbeddingTensor> => {
  try {
    return await raceWithAbort(extractor(prepared, { pooling: EMBED_POOLING }), signal)
  } catch (err) {
    if (isAbortError(err)) throw err
    throw new EmbedderError('Semantic embedding inference failed', { cause: err })
  }
}

/**
 * Embeds texts into L2-normalized vectors. Batch input is truncated per
 * document and mean-pooled. Aborting the signal rejects with `AbortError`.
 *
 * @throws {EmbedderError} when the model cannot load or inference fails.
 * @throws {DOMException} `AbortError` when `signal` fires before completion.
 */
export const embedTexts = async (
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][]> => {
  if (signal?.aborted) throw abortError()
  if (texts.length === 0) return []

  // A model download can take a long time; an abort signal must settle the
  // request instead of waiting for getEmbedder() to finish. Racing the
  // pending load with the signal keeps the cancellation path responsive.
  const extractor = await raceWithAbort(getEmbedder(), signal)
  const prepared = texts.map((text) => truncateForEmbedding(text).trim())
  if (signal?.aborted) throw abortError()

  const output = await runInference(extractor, prepared, signal)
  if (signal?.aborted) throw abortError()

  return toRows(output).map(normalizeEmbedding)
}