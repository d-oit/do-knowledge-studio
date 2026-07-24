import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAdapter } from './providers'
import { OPENROUTER_ROUTERS } from './types'

describe('getAdapter', () => {
  it('returns OpenRouter adapter', () => {
    const adapter = getAdapter('openrouter')
    expect(adapter.id).toBe('openrouter')
    expect(adapter.requiresKey).toBe(true)
  })

  it('returns Ollama adapter', () => {
    const adapter = getAdapter('ollama')
    expect(adapter.id).toBe('ollama')
    expect(adapter.requiresKey).toBe(false)
  })

  it('adapters have sendStream method', () => {
    expect(typeof getAdapter('openrouter').sendStream).toBe('function')
    expect(typeof getAdapter('ollama').sendStream).toBe('function')
  })
})

describe('OpenRouterAdapter integration', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('calls OpenRouter API with Auto Router successfully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello from Auto Router!'
          }
        }
      ]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
        body: expect.stringContaining('"model":"openrouter/auto"'),
      })
    )

    expect(result).toEqual({
      content: 'Hello from Auto Router!',
      provider: 'openrouter',
      model: 'openrouter/auto',
    })
  })

  it('calls OpenRouter API with Free Router successfully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello from Free Router!'
          }
        }
      ]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/free"'),
      })
    )

    expect(result.model).toBe('openrouter/free')
  })

  it('calls OpenRouter API with Fusion Router successfully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello from Fusion Router!'
          }
        }
      ]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/fusion',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/fusion"'),
      })
    )

    expect(result.model).toBe('openrouter/fusion')
  })

  it('calls OpenRouter API with concrete model successfully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello from GPT-4o Mini!'
          }
        }
      ]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openai/gpt-4o-mini"'),
      })
    )

    expect(result.model).toBe('openai/gpt-4o-mini')
  })

  it('correctly handles OpenRouter Target object as model parameter', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello from Target object!'
          }
        }
      ]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const target = OPENROUTER_ROUTERS[0] // openrouter/auto

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: target,
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining(`"model":"${target.slug}"`),
      })
    )

    expect(result.model).toBe(target.slug)
  })

  it('behaves consistently on OpenRouter API failures', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error fallback failure',
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('OpenRouter error 500: Internal Server Error fallback failure')
  })
})
