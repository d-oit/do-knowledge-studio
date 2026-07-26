import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAdapter, sendChat, sendChatStream, fetchOllamaModels } from './providers'
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

describe('sendChat', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('delegates to the correct adapter', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello!' } }]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await sendChat({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(result.content).toBe('Hello!')
    expect(result.provider).toBe('openrouter')
  })
})

describe('sendChatStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('delegates to the correct adapter', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n'))
        controller.close()
      }
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const result = await sendChatStream({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    }, onChunk)

    expect(result.provider).toBe('openrouter')
    expect(onChunk).toHaveBeenCalledWith('Hello')
  })
})

describe('fetchOllamaModels', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('fetches model list from Ollama', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'llama3' }, { name: 'mistral' }]
      }),
    } as Response)

    const models = await fetchOllamaModels('http://localhost:11434')
    expect(models).toEqual(['llama3', 'mistral'])
  })

  it('returns empty array when no models', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    const models = await fetchOllamaModels('http://localhost:11434')
    expect(models).toEqual([])
  })

  it('throws on non-OK response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchOllamaModels('http://localhost:11434')).rejects.toThrow('Ollama tags error 500')
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

  it('calls OpenRouter API with Pareto Router successfully', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello from Pareto Router!' } }]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/pareto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/pareto"'),
      })
    )

    expect(result.model).toBe('openrouter/pareto')
  })

  it('calls OpenRouter API with Body Builder Router successfully', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Hello from Body Builder!' } }]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/body-builder',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/body-builder"'),
      })
    )

    expect(result.model).toBe('openrouter/body-builder')
  })

  it('merges default_params into the request body correctly', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'Params test' } }]
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const customTarget = {
      kind: 'router' as const,
      slug: 'openrouter/custom-router',
      display_name: 'Custom Router',
      default_params: {
        temperature: 0.2,
        max_tokens: 100,
      }
    }

    const adapter = getAdapter('openrouter')
    await adapter.send({
      provider: 'openrouter',
      model: customTarget,
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.2'),
      })
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":100'),
      })
    )
  })

  it('throws when API key is missing', async () => {
    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: '',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('OpenRouter API key is required')
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

  it('throws when response has no content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('OpenRouter returned an empty response')
  })
})

describe('OllamaAdapter integration', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('calls Ollama API successfully', async () => {
    const mockResponse = {
      message: { content: 'Hello from Ollama!' }
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('ollama')
    const result = await adapter.send({
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }]
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"llama3"'),
      })
    )

    expect(result).toEqual({
      content: 'Hello from Ollama!',
      provider: 'ollama',
      model: 'llama3',
    })
  })

  it('calls Ollama API with CPU-only option', async () => {
    const mockResponse = {
      message: { content: 'CPU response' }
    }

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const adapter = getAdapter('ollama')
    await adapter.send({
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
      ollamaCpuOnly: true,
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        body: expect.stringContaining('"num_gpu":0'),
      })
    )
  })

  it('throws when Ollama response has no content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('Ollama returned an empty response')
  })

  it('throws on Ollama API failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }]
      })
    ).rejects.toThrow('Ollama error 503')
  })

  it('rejects invalid Ollama URL', async () => {
    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
        ollamaBaseUrl: 'ftp://invalid',
      })
    ).rejects.toThrow('must use http or https')
  })

  it('rejects non-localhost Ollama URL', async () => {
    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
        ollamaBaseUrl: 'http://example.com:11434',
      })
    ).rejects.toThrow('must point to localhost')
  })
})

describe('OllamaAdapter sendStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('streams Ollama response', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"message":{"content":"Hello"}}\n'))
        controller.enqueue(new TextEncoder().encode('{"message":{"content":" World"}}\n'))
        controller.close()
      }
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const adapter = getAdapter('ollama')
    const result = await adapter.sendStream({
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }]
    }, onChunk)

    expect(result.provider).toBe('ollama')
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('throws when Ollama stream has no content', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close()
      }
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.sendStream({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }]
      }, vi.fn())
    ).rejects.toThrow('Ollama returned an empty response')
  })
})

describe('OpenRouterAdapter sendStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('streams OpenRouter response', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'))
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n'))
        controller.close()
      }
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const adapter = getAdapter('openrouter')
    const result = await adapter.sendStream({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }]
    }, onChunk)

    expect(result.provider).toBe('openrouter')
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('throws when OpenRouter stream has no content', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close()
      }
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }]
      }, vi.fn())
    ).rejects.toThrow('OpenRouter returned an empty response')
  })

  it('throws when API key is missing for stream', async () => {
    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: '',
        messages: [{ role: 'user', content: 'hello' }]
      }, vi.fn())
    ).rejects.toThrow('OpenRouter API key is required')
  })

  it('throws on stream API failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'invalid-key',
        messages: [{ role: 'user', content: 'hello' }]
      }, vi.fn())
    ).rejects.toThrow('OpenRouter error 401')
  })
})
