import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getAdapter,
  sendChat,
  sendChatStream,
  fetchOllamaModels,
} from './providers'
import { resolveJevEndpoint, validateJevBaseUrl, validateOllamaUrl } from './url-guard'
import { OPENROUTER_ROUTERS } from './types'

// ─── getAdapter ─────────────────────────────────────────────────────────────

describe('getAdapter', () => {
  it('returns OpenRouter adapter for "openrouter"', () => {
    const adapter = getAdapter('openrouter')
    expect(adapter.id).toBe('openrouter')
    expect(adapter.requiresKey).toBe(true)
  })

  it('returns Ollama adapter for "ollama"', () => {
    const adapter = getAdapter('ollama')
    expect(adapter.id).toBe('ollama')
    expect(adapter.requiresKey).toBe(false)
  })
  it('returns Local adapter for "local"', () => {
    const adapter = getAdapter('local')
    expect(adapter.id).toBe('local')
    expect(adapter.requiresKey).toBe(false)
  })

  it('returns Jev adapter for "jev"', () => {
    const adapter = getAdapter('jev')
    expect(adapter.id).toBe('jev')
    expect(adapter.requiresKey).toBe(true)
  })

  it('local adapter has sendStream method', () => {
    expect(typeof getAdapter('local').sendStream).toBe('function')
  })

  it('local adapter does not require an API key', () => {
    expect(getAdapter('local').requiresKey).toBe(false)
  })

  it('adapters both have sendStream method', () => {
    expect(typeof getAdapter('openrouter').sendStream).toBe('function')
    expect(typeof getAdapter('ollama').sendStream).toBe('function')
  })
})

// ─── OpenRouter requires API key ────────────────────────────────────────────

describe('OpenRouter API key requirement', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('throws when API key is empty string on send()', async () => {
    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: '',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('OpenRouter API key is required')
  })

  it('throws when API key is empty string on sendStream()', async () => {
    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream(
        {
          provider: 'openrouter',
          model: 'openrouter/auto',
          apiKey: '',
          messages: [{ role: 'user', content: 'hello' }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow('OpenRouter API key is required')
  })
})

// ─── Ollama does NOT require API key ────────────────────────────────────────

describe('Ollama no API key requirement', () => {
  it('Ollama adapter has requiresKey = false', () => {
    const adapter = getAdapter('ollama')
    expect(adapter.requiresKey).toBe(false)
  })

  it('Ollama send() works without providing an API key', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => ({ message: { content: 'hi from ollama' } }),
    } as Response)

    const adapter = getAdapter('ollama')
    const result = await adapter.send({
      provider: 'ollama',
      model: 'llama3',
      apiKey: '', // empty key — should still work
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.content).toBe('hi from ollama')
    expect(result.provider).toBe('ollama')

    globalThis.fetch = originalFetch
  })
})

// ─── validateOllamaUrl ──────────────────────────────────────────────────────

describe('validateOllamaUrl: accepts valid URLs', () => {
  it('accepts localhost URL', () => {
    expect(validateOllamaUrl('http://localhost:11434')).toBe(
      'http://localhost:11434',
    )
  })

  it('accepts https localhost', () => {
    expect(validateOllamaUrl('https://localhost:11435')).toBe(
      'https://localhost:11435',
    )
  })

  it('accepts 127.0.0.1 URL', () => {
    expect(validateOllamaUrl('http://127.0.0.1:11434')).toBe(
      'http://127.0.0.1:11434',
    )
  })

  // URL.hostname returns '[::1]' (bracketed) per the WHATWG URL spec, so the
  // allowlist carries the bracketed form too. This previously documented the
  // reverse — that a valid IPv6 loopback Ollama URL was rejected as untrusted.
  it('accepts bracketed IPv6 loopback', () => {
    expect(validateOllamaUrl('http://[::1]:11434')).toBe('http://[::1]:11434')
  })

  it('still rejects a non-loopback IPv6 literal', () => {
    expect(() => validateOllamaUrl('http://[2001:db8::1]:11434')).toThrow(
      'must point to localhost',
    )
  })

  it('accepts .local hostnames', () => {
    expect(validateOllamaUrl('http://myhost.local:11434')).toBe(
      'http://myhost.local:11434',
    )
  })

  it('accepts hostname ending with .local even with subdomain', () => {
    expect(validateOllamaUrl('http://pi.homelab.local:11434')).toBe(
      'http://pi.homelab.local:11434',
    )
  })

  it('strips trailing slashes', () => {
    expect(validateOllamaUrl('http://localhost:11434/')).toBe(
      'http://localhost:11434',
    )
    expect(validateOllamaUrl('http://localhost:11434///')).toBe(
      'http://localhost:11434',
    )
  })
})

describe('validateOllamaUrl: rejects invalid URLs', () => {
  it('rejects ftp protocol', () => {
    expect(() => validateOllamaUrl('ftp://localhost:11434')).toThrow(
      'must use http or https',
    )
  })

  it('rejects ws protocol', () => {
    expect(() => validateOllamaUrl('ws://localhost:11434')).toThrow(
      'must use http or https',
    )
  })

  it('rejects file protocol', () => {
    expect(() => validateOllamaUrl('file:///some/path')).toThrow(
      'must use http or https',
    )
  })

  it('rejects external hostname', () => {
    expect(() => validateOllamaUrl('http://example.com:11434')).toThrow(
      'must point to localhost',
    )
  })

  it('rejects public IP address', () => {
    expect(() => validateOllamaUrl('http://8.8.8.8:11434')).toThrow(
      'must point to localhost',
    )
  })

  it('rejects 0.0.0.0 (not in allowed set)', () => {
    expect(() => validateOllamaUrl('http://0.0.0.0:11434')).toThrow(
      'must point to localhost',
    )
  })

  it('rejects invalid URL string entirely', () => {
    expect(() => validateOllamaUrl('not-a-url')).toThrow(
      'Invalid Ollama base URL',
    )
  })

  it('rejects empty string', () => {
    expect(() => validateOllamaUrl('')).toThrow('Invalid Ollama base URL')
  })
})

// ─── validateJevBaseUrl ──────────────────────────────────────────────────────

describe('validateJevBaseUrl', () => {
  it('accepts the TypeSafe cloud host', () => {
    expect(validateJevBaseUrl('https://api.typesafe.ai')).toBe('https://api.typesafe.ai')
  })

  it('accepts a local Von server on localhost', () => {
    expect(validateJevBaseUrl('http://localhost:8000')).toBe('http://localhost:8000')
  })

  it('accepts a .local Von server', () => {
    expect(validateJevBaseUrl('http://von.local:8000')).toBe('http://von.local:8000')
  })

  it('strips trailing slashes', () => {
    expect(validateJevBaseUrl('https://api.typesafe.ai/')).toBe('https://api.typesafe.ai')
  })

  it('rejects an arbitrary host', () => {
    expect(() => validateJevBaseUrl('https://evil.com')).toThrow(
      'known cloud host, localhost, or a .local hostname',
    )
  })

  it('rejects a non-http protocol', () => {
    expect(() => validateJevBaseUrl('ftp://api.typesafe.ai')).toThrow('must use http or https')
  })

  it('rejects an unparseable URL', () => {
    expect(() => validateJevBaseUrl('not a url')).toThrow('Invalid Jev base URL')
  })

  it('rejects a lookalike host that merely contains an allowlisted name', () => {
    expect(() => validateJevBaseUrl('https://api.typesafe.ai.evil.com')).toThrow(
      'known cloud host, localhost, or a .local hostname',
    )
  })

  it('rejects credentials smuggled into the URL', () => {
    expect(() => validateJevBaseUrl('https://api.typesafe.ai@evil.com')).toThrow(
      'known cloud host, localhost, or a .local hostname',
    )
  })

  it('rejects a non-loopback address', () => {
    expect(() => validateJevBaseUrl('http://169.254.169.254')).toThrow('known cloud host')
  })
})

// ─── resolveJevEndpoint ──────────────────────────────────────────────────────

describe('resolveJevEndpoint', () => {
  /** Joins the returned parts the same way the adapter does. */
  const jevEndpoint = (baseUrl: string): string => {
    const { origin, path } = resolveJevEndpoint(baseUrl)
    return `${origin}${path}`
  }

  it('appends the systemone path to an allowlisted cloud base', () => {
    expect(jevEndpoint('https://api.typesafe.ai')).toBe('https://api.typesafe.ai/v1/systemone')
  })

  it('normalizes a trailing slash instead of doubling it', () => {
    expect(jevEndpoint('https://api.typesafe.ai/')).toBe('https://api.typesafe.ai/v1/systemone')
  })

  it('builds a local Von endpoint with its port intact', () => {
    expect(jevEndpoint('http://localhost:8000')).toBe('http://localhost:8000/v1/systemone')
  })

  it('refuses to build an endpoint for a host outside the allowlist', () => {
    expect(() => resolveJevEndpoint('https://evil.com')).toThrow('known cloud host')
  })

  it('normalizes integer- and hex-encoded loopback to 127.0.0.1 and allows it', () => {
    // These LOOK like host-injection attempts but are the local machine, which
    // is the Von self-host path. new URL() canonicalizes them before the
    // allowlist runs; pinned so a future "hardening" does not break Von.
    expect(jevEndpoint('http://2130706433')).toBe('http://127.0.0.1/v1/systemone')
    expect(jevEndpoint('http://0x7f000001')).toBe('http://127.0.0.1/v1/systemone')
  })

  it('blocks the cloud metadata endpoint', () => {
    expect(() => resolveJevEndpoint('http://169.254.169.254')).toThrow('known cloud host')
  })

  it('allows a bracketed IPv6 loopback literal', () => {
    // URL.hostname yields '[::1]'; the allowlist carries both spellings so a
    // local Von server bound to IPv6 loopback stays reachable.
    expect(jevEndpoint('http://[::1]:8000')).toBe('http://[::1]:8000/v1/systemone')
  })

  it('blocks a non-http scheme', () => {
    expect(() => resolveJevEndpoint('file:///etc/passwd')).toThrow('must use http or https')
  })

  it('keeps the path a constant and the origin allowlisted', () => {
    // The adapter fetches `origin` + this constant; neither carries a
    // user-controlled substring, which is what keeps the SSRF rule satisfied
    // without a suppression.
    const { origin, path } = resolveJevEndpoint('http://von.local:8000')
    expect(origin).toBe('http://von.local:8000')
    expect(path).toBe('/v1/systemone')
  })
})

// ─── JevAdapter ──────────────────────────────────────────────────────────────

describe('JevAdapter', () => {
  const originalFetch = globalThis.fetch

  const jevRequest = {
    provider: 'jev' as const,
    model: 'jev-1.13.0',
    apiKey: 'sk-jev-test',
    messages: [{ role: 'user' as const, content: 'How should I structure my notes?' }],
  }

  const okResponse = (body: unknown) =>
    vi.fn().mockResolvedValueOnce({ ok: true, json: () => body } as Response)

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('posts to /v1/systemone with state and questions, not a chat endpoint', async () => {
    const mockFetch = okResponse({
      model: 'jev-1.13.0',
      answers: {
        respond: {
          type: 'choice',
          choice: 'helpful',
          confidence: 0.95,
          probabilities: { helpful: 0.95, clarify: 0.05 },
        },
      },
      usage: { input_tokens: 100, output_tokens: 0 },
    })
    globalThis.fetch = mockFetch

    const result = await getAdapter('jev').send(jevRequest)

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(url).not.toContain('chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-jev-test')
    const body = JSON.parse(init.body as string) as {
      model: string
      state: string
      questions: Record<string, { type: string; criteria: Record<string, string> }>
    }
    expect(body.model).toBe('jev-1.13.0')
    expect(body.state).toContain('user: How should I structure my notes?')
    expect(body.questions.respond.type).toBe('choice')
    expect(body.questions.respond.criteria).toHaveProperty('helpful')

    expect(result.provider).toBe('jev')
    expect(result.model).toBe('jev-1.13.0')
    expect(result.content).toContain('helpful')
    expect(result.content).toContain('confidence: 95.0%')
  })

  it('uses a configured Von base URL instead of the cloud API', async () => {
    const mockFetch = okResponse({ model: 'von-1.2', answers: {} })
    globalThis.fetch = mockFetch

    await getAdapter('jev').send({ ...jevRequest, model: 'von-1.2', jevBaseUrl: 'http://localhost:8000' })

    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:8000/v1/systemone')
  })

  it('refuses to send to a base URL outside the allowlist', async () => {
    const mockFetch = vi.fn()
    globalThis.fetch = mockFetch

    await expect(
      getAdapter('jev').send({ ...jevRequest, jevBaseUrl: 'https://evil.com' }),
    ).rejects.toThrow('known cloud host')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maps a 401 to an invalid-key message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized'),
    } as Response)

    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('invalid or revoked API key')
  })

  it('maps a 422 to a missing-field message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: () => Promise.resolve('state required'),
    } as Response)

    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('missing required field')
  })

  it('mentions the versioned model id on a 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('unknown model'),
    } as Response)

    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('jev-1.13.0, not jev-1.13')
  })

  it('falls back to status and body for an unmapped error code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('upstream busy'),
    } as Response)

    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('Jev error 503: upstream busy')
  })

  it('emits a single chunk from sendStream because the endpoint is not streamable', async () => {
    globalThis.fetch = okResponse({
      model: 'jev-1.13.0',
      answers: { respond: { type: 'choice', choice: 'clarify', confidence: 0.6 } },
    })
    const chunks: string[] = []

    const result = await getAdapter('jev').sendStream(jevRequest, (c) => { chunks.push(c) })

    expect(chunks).toHaveLength(1)
    expect(result.content).toContain('clarify')
  })

  it('renders a noul answer as a likelihood without a confidence field', async () => {
    globalThis.fetch = okResponse({
      model: 'jev-1.13.0',
      answers: { rain: { type: 'noul', noul: 0.31 } },
    })

    const result = await getAdapter('jev').send(jevRequest)
    expect(result.content).toContain('**rain**: 31.0% likely')
  })

  it('rejects a malformed body instead of throwing a TypeError from the renderer', async () => {
    // `answers` is remote input. A non-object value used to reach
    // Object.entries/JSON.stringify and escape as a TypeError; it must surface
    // as a provider error instead.
    globalThis.fetch = okResponse({ model: 'jev-1.13.0', answers: 42 })
    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('malformed response')
  })

  it('rejects a body whose answer fields have the wrong types', async () => {
    globalThis.fetch = okResponse({ model: 'jev-1.13.0', answers: { r: { choice: { nested: true } } } })
    await expect(getAdapter('jev').send(jevRequest)).rejects.toThrow('malformed response')
  })

  it('renders a valid body with no answers key without erroring', async () => {
    globalThis.fetch = okResponse({ model: 'jev-1.13.0' })
    const result = await getAdapter('jev').send(jevRequest)
    expect(result.model).toBe('jev-1.13.0')
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('sends the default cloud request through the same allowlist guard', async () => {
    const mockFetch = okResponse({ model: 'jev-1.13.0', answers: {} })
    globalThis.fetch = mockFetch

    await getAdapter('jev').send({ ...jevRequest, jevBaseUrl: undefined })

    // A single code path builds the endpoint, so the default cannot bypass the
    // host allowlist the way a hardcoded constant would.
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.typesafe.ai/v1/systemone')
  })

  it('refuses an empty-string base URL by falling back to the guarded default', async () => {
    const mockFetch = okResponse({ model: 'jev-1.13.0', answers: {} })
    globalThis.fetch = mockFetch

    await getAdapter('jev').send({ ...jevRequest, jevBaseUrl: '' })

    expect(mockFetch.mock.calls[0][0]).toBe('https://api.typesafe.ai/v1/systemone')
  })

  it('refuses to send without an API key', async () => {
    const mockFetch = okResponse({ model: 'jev-1.13.0', answers: {} })
    globalThis.fetch = mockFetch

    // requiresKey must be enforced at the adapter: sendChat/sendChatStream are
    // exported and an empty key would leave as the header `Bearer `.
    await expect(getAdapter('jev').send({ ...jevRequest, apiKey: '' })).rejects.toThrow(
      'API key is required',
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('never returns empty content when a probability table is empty', async () => {
    // `probabilities: {}` is truthy but contributed nothing, which used to push
    // an empty part into the joined output. The renderer now falls back to the
    // raw answer JSON, so content is never the empty string the chat hook would
    // silently drop.
    globalThis.fetch = okResponse({
      model: 'jev-1.13.0',
      answers: { respond: { probabilities: {} } },
    })
    const result = await getAdapter('jev').send(jevRequest)
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('emits exactly one non-empty chunk from sendStream', async () => {
    globalThis.fetch = okResponse({
      model: 'jev-1.13.0',
      answers: { respond: { type: 'choice', choice: 'helpful', confidence: 0.9 } },
    })
    const chunks: string[] = []
    const result = await getAdapter('jev').sendStream(jevRequest, (c) => { chunks.push(c) })
    expect(chunks).toEqual([result.content])
    expect(chunks[0].length).toBeGreaterThan(0)
  })
})

// ─── fetchOllamaModels error handling ──────────────────────────────────────

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
      json: () => ({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
    } as Response)

    const models = await fetchOllamaModels('http://localhost:11434')
    expect(models).toEqual(['llama3', 'mistral'])
  })

  it('returns empty array when models field is missing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({}),
    } as Response)

    const models = await fetchOllamaModels('http://localhost:11434')
    expect(models).toEqual([])
  })

  it('returns empty array when models field is empty array', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ models: [] }),
    } as Response)

    const models = await fetchOllamaModels('http://localhost:11434')
    expect(models).toEqual([])
  })

  it('throws on non-OK response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    await expect(fetchOllamaModels('http://localhost:11434')).rejects.toThrow(
      'Ollama tags error 500',
    )
  })

  it('throws on 404 response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    await expect(fetchOllamaModels('http://localhost:11434')).rejects.toThrow(
      'Ollama tags error 404',
    )
  })

  it('throws on invalid Ollama URL', async () => {
    await expect(fetchOllamaModels('http://evil.com/api')).rejects.toThrow(
      'must point to localhost',
    )
  })

  it('throws on non-http URL', async () => {
    await expect(fetchOllamaModels('ftp://localhost:11434')).rejects.toThrow(
      'must use http or https',
    )
  })
})

// ─── sendChat (integration) ─────────────────────────────────────────────────

describe('sendChat', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('delegates to the correct OpenRouter adapter', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ choices: [{ message: { content: 'Hello!' } }] }),
    } as Response)

    const result = await sendChat({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(result.content).toBe('Hello!')
    expect(result.provider).toBe('openrouter')
  })
})

// ─── sendChatStream (integration) ───────────────────────────────────────────

describe('sendChatStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('delegates to the correct OpenRouter adapter for streaming', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n'),
        )
        controller.enqueue(encoder.encode('data: [DONE]\n'))
        controller.close()
      },
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const result = await sendChatStream(
      {
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }],
      },
      onChunk,
    )

    expect(result.provider).toBe('openrouter')
    expect(onChunk).toHaveBeenCalledWith('Hello')
  })
})

// ─── OpenRouterAdapter integration ──────────────────────────────────────────

describe('OpenRouterAdapter integration', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('calls OpenRouter API with Auto Router successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Auto Router!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/auto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        body: expect.stringContaining('"model":"openrouter/auto"'),
      }),
    )

    expect(result).toEqual({
      content: 'Hello from Auto Router!',
      provider: 'openrouter',
      model: 'openrouter/auto',
    })
  })

  it('calls OpenRouter API with Free Router successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Free Router!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/free',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/free"'),
      }),
    )

    expect(result.model).toBe('openrouter/free')
  })

  it('calls OpenRouter API with Fusion Router successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Fusion Router!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/fusion',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/fusion"'),
      }),
    )

    expect(result.model).toBe('openrouter/fusion')
  })

  it('calls OpenRouter API with concrete model successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from GPT-4o Mini!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openai/gpt-4o-mini"'),
      }),
    )

    expect(result.model).toBe('openai/gpt-4o-mini')
  })

  it('correctly handles OpenRouter Target object as model parameter', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Target object!' } }],
      }),
    } as Response)

    const target = OPENROUTER_ROUTERS[0] // openrouter/auto

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: target,
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining(`"model":"${target.slug}"`),
      }),
    )

    expect(result.model).toBe(target.slug)
  })

  it('calls OpenRouter API with Pareto Router successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Pareto Router!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/pareto',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/pareto"'),
      }),
    )

    expect(result.model).toBe('openrouter/pareto')
  })

  it('calls OpenRouter API with Body Builder Router successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Hello from Body Builder!' } }],
      }),
    } as Response)

    const adapter = getAdapter('openrouter')
    const result = await adapter.send({
      provider: 'openrouter',
      model: 'openrouter/body-builder',
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"openrouter/body-builder"'),
      }),
    )

    expect(result.model).toBe('openrouter/body-builder')
  })

  it('merges default_params into the request body correctly', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({
        choices: [{ message: { content: 'Params test' } }],
      }),
    } as Response)

    const customTarget = {
      kind: 'router' as const,
      slug: 'openrouter/custom-router',
      display_name: 'Custom Router',
      default_params: { temperature: 0.2, max_tokens: 100 },
    }

    const adapter = getAdapter('openrouter')
    await adapter.send({
      provider: 'openrouter',
      model: customTarget,
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"temperature":0.2'),
      }),
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"max_tokens":100'),
      }),
    )
  })

  it('behaves consistently on OpenRouter API failures', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error fallback failure'),
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow(
      'OpenRouter error 500: Internal Server Error fallback failure',
    )
  })

  it('throws when response has no content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ choices: [] }),
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.send({
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('OpenRouter returned an empty response')
  })
})

// ─── OllamaAdapter integration ──────────────────────────────────────────────

describe('OllamaAdapter integration', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('calls Ollama API successfully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ message: { content: 'Hello from Ollama!' } }),
    } as Response)

    const adapter = getAdapter('ollama')
    const result = await adapter.send({
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"llama3"'),
      }),
    )

    expect(result).toEqual({
      content: 'Hello from Ollama!',
      provider: 'ollama',
      model: 'llama3',
    })
  })

  it('calls Ollama API with custom base URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ message: { content: 'custom url response' } }),
    } as Response)

    const adapter = getAdapter('ollama')
    const result = await adapter.send({
      provider: 'ollama',
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
      ollamaBaseUrl: 'http://localhost:8080',
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/chat',
      expect.any(Object),
    )
    expect(result.content).toBe('custom url response')
  })

  it('calls Ollama API with CPU-only option', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({ message: { content: 'CPU response' } }),
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
      }),
    )
  })

  it('throws when Ollama response has no content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => ({}),
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('Ollama returned an empty response')
  })

  it('throws on Ollama API failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('Ollama error 503')
  })

  it('rejects invalid Ollama URL (non-http protocol)', async () => {
    const adapter = getAdapter('ollama')
    await expect(
      adapter.send({
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
        ollamaBaseUrl: 'ftp://invalid',
      }),
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
      }),
    ).rejects.toThrow('must point to localhost')
  })
})

// ─── OllamaAdapter sendStream ────────────────────────────────────────────────

describe('OllamaAdapter sendStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('streams Ollama response via NDJSON', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('{"message":{"content":"Hello"}}\n'),
        )
        controller.enqueue(
          new TextEncoder().encode('{"message":{"content":" World"}}\n'),
        )
        controller.close()
      },
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const adapter = getAdapter('ollama')
    const result = await adapter.sendStream(
      {
        provider: 'ollama',
        model: 'llama3',
        messages: [{ role: 'user', content: 'hello' }],
      },
      onChunk,
    )

    expect(result.provider).toBe('ollama')
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('throws when Ollama stream has no content', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const adapter = getAdapter('ollama')
    await expect(
      adapter.sendStream(
        {
          provider: 'ollama',
          model: 'llama3',
          messages: [{ role: 'user', content: 'hello' }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow('Ollama returned an empty response')
  })
})

// ─── OpenRouterAdapter sendStream ────────────────────────────────────────────

describe('OpenRouterAdapter sendStream', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('streams OpenRouter response via SSE', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
          ),
        )
        controller.enqueue(
          new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":" World"}}]}\n',
          ),
        )
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n'))
        controller.close()
      },
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const onChunk = vi.fn()
    const adapter = getAdapter('openrouter')
    const result = await adapter.sendStream(
      {
        provider: 'openrouter',
        model: 'openrouter/auto',
        apiKey: 'test-key',
        messages: [{ role: 'user', content: 'hello' }],
      },
      onChunk,
    )

    expect(result.provider).toBe('openrouter')
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('throws when OpenRouter stream has no content', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.close()
      },
    })

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream(
        {
          provider: 'openrouter',
          model: 'openrouter/auto',
          apiKey: 'test-key',
          messages: [{ role: 'user', content: 'hello' }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow('OpenRouter returned an empty response')
  })

  it('throws on stream API failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response)

    const adapter = getAdapter('openrouter')
    await expect(
      adapter.sendStream(
        {
          provider: 'openrouter',
          model: 'openrouter/auto',
          apiKey: 'invalid-key',
          messages: [{ role: 'user', content: 'hello' }],
        },
        vi.fn(),
      ),
    ).rejects.toThrow('OpenRouter error 401')
  })
})
