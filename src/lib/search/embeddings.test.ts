import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the transformers.js package entirely — no model download in tests.
const transformersMock = vi.hoisted(() => ({ pipeline: vi.fn() }))

vi.mock('@huggingface/transformers', () => transformersMock)

import {
  embedTexts,
  getEmbedder,
  disposeEmbedder,
  isEmbedderReady,
  getEmbedderStatus,
  getEmbedderError,
  EMBEDDING_MODEL_ID,
  EMBED_MAX_CHARS,
  normalizeEmbedding,
  serializeEmbedding,
  truncateForEmbedding,
} from './embeddings'

/** A fake pipeline returning deterministic 4-dim vectors per text. */
const makeExtractor = (): unknown =>
  vi.fn((texts: string[]) => ({
    dims: [texts.length, 4],
    tolist: () => texts.map((text: string) => [text.length % 7, 0, 0, 0]),
  }))

describe('embedding runtime (mocked transformers)', () => {
  beforeEach(() => {
    disposeEmbedder()
    transformersMock.pipeline.mockClear()
    transformersMock.pipeline.mockImplementation(() => makeExtractor())
  })

  it('lazily loads the pipeline once and reuses it across calls', async () => {
    const vectors = await embedTexts(['alpha', 'beta'])
    expect(vectors).toHaveLength(2)
    await embedTexts(['gamma'])
    // One pipeline() invocation for the whole suite lifetime of the singleton.
    expect(transformersMock.pipeline).toHaveBeenCalledTimes(1)
    expect(transformersMock.pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      EMBEDDING_MODEL_ID,
      expect.objectContaining({ dtype: 'q8', device: 'wasm' }),
    )
  })

  it('transitions idle → loading → ready through isEmbedderReady', async () => {
    expect(getEmbedderStatus()).toBe('idle')
    expect(isEmbedderReady()).toBe(false)

    let resolveLoad!: (value: unknown) => void
    transformersMock.pipeline.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve
        }),
    )
    const pending = getEmbedder()
    expect(getEmbedderStatus()).toBe('loading')
    expect(isEmbedderReady()).toBe(false)

    // The dynamic import suspends loadEmbedder before pipeline() runs, so
    // wait until the mock has actually been invoked.
    await vi.waitFor(() => {
      expect(resolveLoad).toBeTypeOf('function')
    })
    resolveLoad(makeExtractor())
    await pending
    expect(getEmbedderStatus()).toBe('ready')
    expect(isEmbedderReady()).toBe(true)
    expect(getEmbedderError()).toBeNull()
  })

  it('embeds a batch in one extractor call and L2-normalizes each row', async () => {
    const extractor = makeExtractor() as ReturnType<typeof vi.fn>
    transformersMock.pipeline.mockImplementation(() => extractor)

    const vectors = await embedTexts(['alpha', 'beta'])
    expect(extractor).toHaveBeenCalledTimes(1)
    expect(extractor).toHaveBeenCalledWith(['alpha', 'beta'], { pooling: 'mean' })
    expect(vectors).toHaveLength(2)
    // [value, 0, 0, 0] normalizes to [1, 0, 0, 0].
    for (const vec of vectors) {
      expect(vec[0]).toBeCloseTo(1)
      expect(vec[1]).toBeCloseTo(0)
    }
  })

  it('truncates long documents to EMBED_MAX_CHARS before embedding', async () => {
    const extractor = makeExtractor() as ReturnType<typeof vi.fn>
    transformersMock.pipeline.mockImplementation(() => extractor)

    const longDoc = 'a'.repeat(EMBED_MAX_CHARS + 100)
    await embedTexts([longDoc])
    expect(extractor).toHaveBeenCalledWith(
      ['a'.repeat(EMBED_MAX_CHARS)],
      expect.anything(),
    )
    expect(truncateForEmbedding(longDoc)).toHaveLength(EMBED_MAX_CHARS)
    expect(truncateForEmbedding('short')).toBe('short')
  })

  it('throws a descriptive EmbedderError when the model cannot load', async () => {
    transformersMock.pipeline.mockRejectedValue(new Error('network blocked'))

    const pending = embedTexts(['x'])
    await expect(pending).rejects.toMatchObject({ name: 'EmbedderError' })
    await expect(pending).rejects.toThrow(/network blocked/)
    await expect(pending).rejects.toThrow(EMBEDDING_MODEL_ID)
    expect(isEmbedderReady()).toBe(false)
    expect(getEmbedderStatus()).toBe('error')
    expect(getEmbedderError()).toContain('network blocked')
  })

  it('retries the model load after a failure (cached reject is dropped)', async () => {
    transformersMock.pipeline.mockRejectedValueOnce(new Error('first attempt failed'))
    await expect(embedTexts(['x'])).rejects.toMatchObject({ name: 'EmbedderError' })

    transformersMock.pipeline.mockImplementation(() => makeExtractor())
    const vectors = await embedTexts(['y'])
    expect(vectors).toHaveLength(1)
    expect(transformersMock.pipeline).toHaveBeenCalledTimes(2)
    expect(isEmbedderReady()).toBe(true)
  })

  it('rejects with AbortError for a pre-aborted signal without touching the model', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(embedTexts(['x'], controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(transformersMock.pipeline).not.toHaveBeenCalled()
  })

  it('normalizeEmbedding produces unit vectors and preserves zero vectors', () => {
    const vec = normalizeEmbedding([3, 4])
    expect(vec[0]).toBeCloseTo(0.6)
    expect(vec[1]).toBeCloseTo(0.8)
    expect(normalizeEmbedding([0, 0])).toEqual([0, 0])
  })

  it('serializeEmbedding returns a detached, JSON-safe copy', () => {
    const original = [1, 2, 3]
    const copy = serializeEmbedding(original)
    original[0] = 99
    expect(copy).toEqual([1, 2, 3])
    expect(JSON.stringify(copy)).toBe('[1,2,3]')
  })

  it('returns an empty result for an empty input batch', async () => {
    expect(transformersMock.pipeline).not.toHaveBeenCalled()
    await expect(embedTexts([])).resolves.toEqual([])
    expect(transformersMock.pipeline).not.toHaveBeenCalled()
  })
})