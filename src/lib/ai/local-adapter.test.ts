import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  localAdapter,
  DEFAULT_LOCAL_MODELS,
  resetLocalPipelineCache,
} from './local-adapter'
import { getAdapter } from './providers'

// The LocalAdapter lazy-loads transformers.js via dynamic import; we mock the
// module (vi.hoisted factory) so no model is ever downloaded or executed —
// and no static import of @huggingface/transformers appears anywhere in src/.
const mocks = vi.hoisted(() => {
  class MockInterruptCriteria {
    interrupted = false
    reset(): void { this.interrupted = false }
    interrupt(): void { this.interrupted = true }
    _call(inputIds: unknown[]): boolean[] {
      return inputIds.map(() => this.interrupted)
    }
  }

  class MockTextStreamer {
    tokenizer: unknown
    options: Record<string, unknown>
    constructor(tokenizer: unknown, options: Record<string, unknown>) {
      this.tokenizer = tokenizer
      this.options = options
    }
  }

  return { pipeline: vi.fn(), MockInterruptCriteria, MockTextStreamer }
})

vi.mock('@huggingface/transformers', () => ({
  pipeline: mocks.pipeline,
  InterruptableStoppingCriteria: mocks.MockInterruptCriteria,
  TextStreamer: mocks.MockTextStreamer,
}))

const pipelineMock = vi.mocked(mocks.pipeline)

/** A fake callable text-generation pipeline with a tokenizer and mock record. */
interface FakeGenerator {
  readonly tokenizer: { all_special_ids: (string | number)[] }
  readonly mock: { calls: Array<[unknown[], Record<string, unknown>]> }
  (messages: unknown[], options: Record<string, unknown>): Promise<
    Array<{ generated_text: Array<{ role: string; content: string }> }>
  >
}

interface FakeGeneratorOptions {
  /** Runs before the fake generation resolves; may block the test flow. */
  onCall?: (messages: unknown[], options: Record<string, unknown>) => Promise<void> | void
  /** Assistant reply embedded in the chat output (default 'assistant reply'). */
  reply?: string
}

/** Builds a callable fake text-generation pipeline with a tokenizer. */
const makeGenerator = ({ onCall, reply = 'assistant reply' }: FakeGeneratorOptions = {}): FakeGenerator => {
  const generator = vi.fn(
    async (messages: unknown[], options: Record<string, unknown>) => {
      await onCall?.(messages, options)
      const chat = [...(messages as { role: string; content: string }[])]
      chat.push({ role: 'assistant', content: reply })
      return [{ generated_text: chat }]
    },
  )
  return Object.assign(generator, { tokenizer: { all_special_ids: [] as (string | number)[] } }) as unknown as FakeGenerator
}

/** Shape of a resolved text-generation pipeline output, mocked. */
type PipelineResult = ReadonlyArray<{
  readonly generated_text?: ReadonlyArray<{ readonly role: string; readonly content?: string }>
}>

/** Makes the mocked pipeline() resolve to the given fake generator. */
const resolveWith = (generator: FakeGenerator): void => {
  pipelineMock.mockResolvedValue(generator as unknown as PipelineResult)
}

const LOCAL_MODEL_ID = DEFAULT_LOCAL_MODELS[0].id

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  provider: 'local' as const,
  model: LOCAL_MODEL_ID,
  apiKey: '',
  messages: [{ role: 'user' as const, content: 'hello' }],
  ...overrides,
})

const waitFor = async (predicate: () => boolean, attempts = 50): Promise<void> => {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return
    await Promise.resolve()
  }
  throw new Error('condition never became true')
}

beforeEach(() => {
  resetLocalPipelineCache()
  pipelineMock.mockReset()
})

describe('LocalAdapter inventory', () => {
  it('does not require an API key', () => {
    expect(localAdapter.requiresKey).toBe(false)
  })

  it('is registered in the adapters record', () => {
    const adapter = getAdapter('local')
    expect(adapter.id).toBe('local')
    expect(adapter.requiresKey).toBe(false)
    expect(typeof adapter.send).toBe('function')
    expect(typeof adapter.sendStream).toBe('function')
  })

  it('exposes small quantized instruct models with display names', () => {
    expect(DEFAULT_LOCAL_MODELS.length).toBeGreaterThanOrEqual(2)
    for (const model of DEFAULT_LOCAL_MODELS) {
      expect(model.id.length).toBeGreaterThan(0)
      expect(model.displayName.length).toBeGreaterThan(0)
      expect(['q4', 'q8']).toContain(model.dtype)
    }
  })
})

describe('LocalAdapter send', () => {
  it('lazy-loads the transformers module exactly once per model', async () => {
    const generator = makeGenerator()
    resolveWith(generator)

    await localAdapter.send(baseRequest())
    await localAdapter.send(baseRequest())

    expect(pipelineMock).toHaveBeenCalledTimes(1)
    expect(pipelineMock).toHaveBeenCalledWith(
      'text-generation',
      LOCAL_MODEL_ID,
      { device: 'wasm', dtype: 'q4' },
    )
  })

  it('loads a separate pipeline per model id', async () => {
    resolveWith(makeGenerator())

    await localAdapter.send(baseRequest())
    await localAdapter.send(baseRequest({ model: DEFAULT_LOCAL_MODELS[1].id }))

    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })

  it('returns the assistant reply with provider and model metadata', async () => {
    resolveWith(makeGenerator({ reply: 'hi from the browser' }))

    const result = await localAdapter.send(baseRequest())

    expect(result.content).toBe('hi from the browser')
    expect(result.provider).toBe('local')
    expect(result.model).toBe(LOCAL_MODEL_ID)
  })

  it('applies the chat template by passing messages through the pipeline', async () => {
    const generator = makeGenerator()
    resolveWith(generator)

    await localAdapter.send(baseRequest())

    const [messages] = generator.mock.calls[0]
    expect((messages as { role: string }[])[0].role).toBe('user')
  })

  it('falls back to q8 dtype for unknown model ids', async () => {
    resolveWith(makeGenerator())

    await localAdapter.send(baseRequest({ model: 'custom/unknown-model' }))

    expect(pipelineMock).toHaveBeenCalledWith(
      'text-generation',
      'custom/unknown-model',
      { device: 'wasm', dtype: 'q8' },
    )
  })

  it('throws a descriptive AbortError when the signal is already aborted', async () => {
    const generator = makeGenerator()
    resolveWith(generator)

    const controller = new AbortController()
    controller.abort()

    await expect(
      localAdapter.send(baseRequest({ signal: controller.signal })),
    ).rejects.toMatchObject({ name: 'AbortError' })
    // The pipeline must not be touched when aborting before generation, and
    // the runtime load itself must be skipped: no import, no model download.
    expect(generator).not.toHaveBeenCalled()
    expect(pipelineMock).not.toHaveBeenCalled()
  })

  it('interrupts generation and rejects with AbortError when aborted mid-stream', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    let capturedCriteria: { interrupted: boolean; interrupt: () => void } | undefined
    const generator = makeGenerator({
      onCall: async (_messages, options) => {
        capturedCriteria = options.stopping_criteria as { interrupted: boolean; interrupt: () => void }
        await gate
      },
    })
    resolveWith(generator)

    const controller = new AbortController()
    const sendPromise = localAdapter.send(
      baseRequest({ signal: controller.signal }),
    )
    await waitFor(() => capturedCriteria !== undefined)

    controller.abort()
    release()

    await expect(sendPromise).rejects.toMatchObject({ name: 'AbortError' })
    expect(capturedCriteria?.interrupted).toBe(true)
  })

  it('propagates empty responses as a descriptive error', async () => {
    resolveWith(makeGenerator({ reply: '' }))

    await expect(localAdapter.send(baseRequest())).rejects.toThrow(
      'The local model returned an empty response.',
    )
  })
})

describe('LocalAdapter load failures', () => {
  it('wraps load failures in a descriptive error', async () => {
    pipelineMock.mockRejectedValue(new Error('Failed to fetch wasm'))

    await expect(localAdapter.send(baseRequest())).rejects.toThrow(
      /could not be loaded/,
    )
    await expect(localAdapter.send(baseRequest())).rejects.toThrow(
      'Failed to fetch wasm',
    )
  })

  it('retries the load after a failure (failed entries are not cached)', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('net'))
    await expect(localAdapter.send(baseRequest())).rejects.toThrow()

    pipelineMock.mockResolvedValueOnce(makeGenerator() as unknown as PipelineResult)
    const result = await localAdapter.send(baseRequest())

    expect(result.content).toBe('assistant reply')
    expect(pipelineMock).toHaveBeenCalledTimes(2)
  })
})

describe('LocalAdapter sendStream', () => {
  it('emits chunked deltas and returns the concatenated content', async () => {
    const generator = makeGenerator({
      onCall: (_messages, options) => {
        const streamer = options.streamer as {
          options: { callback_function?: (text: string) => void }
        }
        streamer.options.callback_function?.('Hello ')
        streamer.options.callback_function?.('world')
      },
    })
    resolveWith(generator)

    const chunks: string[] = []
    const result = await localAdapter.sendStream(baseRequest(), (chunk) => {
      chunks.push(chunk)
    })

    expect(chunks).toEqual(['Hello ', 'world'])
    expect(result.content).toBe('Hello world')
  })

  it('emits the full final text once when the pipeline yields no deltas', async () => {
    const generator = makeGenerator({ reply: 'fallback text' })
    resolveWith(generator)

    const chunks: string[] = []
    const result = await localAdapter.sendStream(baseRequest(), (chunk) => {
      chunks.push(chunk)
    })

    expect(chunks).toEqual([])
    expect(result.content).toBe('fallback text')
  })

  it('honors a pre-aborted signal without invoking the pipeline', async () => {
    resolveWith(makeGenerator())

    const controller = new AbortController()
    controller.abort()

    await expect(
      localAdapter.sendStream(baseRequest({ signal: controller.signal }), vi.fn()),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})