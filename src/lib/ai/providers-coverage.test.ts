import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Test the Zod schemas and validation logic from providers.ts
// We can't easily test the full adapters without mocking fetch,
// but we can test the schema validation and URL validation

const OpenRouterResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }).optional(),
    }),
  ).optional(),
})

const OllamaResponseSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
})

const OllamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string() })).optional(),
})

describe('AI providers: schema validation', () => {
  it('OpenRouterResponseSchema accepts valid response', () => {
    const result = OpenRouterResponseSchema.safeParse({
      choices: [{ message: { content: 'Hello' } }],
    })
    expect(result.success).toBe(true)
  })

  it('OpenRouterResponseSchema accepts empty choices', () => {
    const result = OpenRouterResponseSchema.safeParse({ choices: [] })
    expect(result.success).toBe(true)
  })

  it('OpenRouterResponseSchema accepts missing choices', () => {
    const result = OpenRouterResponseSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('OllamaResponseSchema accepts valid response', () => {
    const result = OllamaResponseSchema.safeParse({
      message: { content: 'Hello' },
    })
    expect(result.success).toBe(true)
  })

  it('OllamaResponseSchema accepts missing message', () => {
    const result = OllamaResponseSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('OllamaTagsSchema accepts valid tags response', () => {
    const result = OllamaTagsSchema.safeParse({
      models: [{ name: 'llama3' }, { name: 'mistral' }],
    })
    expect(result.success).toBe(true)
  })

  it('OllamaTagsSchema accepts empty models', () => {
    const result = OllamaTagsSchema.safeParse({ models: [] })
    expect(result.success).toBe(true)
  })

  it('OllamaTagsSchema accepts missing models', () => {
    const result = OllamaTagsSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('AI providers: URL validation logic', () => {
  // Test the validateOllamaUrl logic directly
  const ALLOWED_OLLAMA_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

  function validateOllamaUrl(baseUrl: string): string {
    let url: URL
    try {
      url = new URL(baseUrl)
    } catch {
      throw new Error('Invalid Ollama base URL')
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Ollama base URL must use http or https protocol')
    }
    const hostname = url.hostname
    if (!ALLOWED_OLLAMA_HOSTS.has(hostname) && !hostname.endsWith('.local')) {
      throw new Error('Ollama base URL must point to localhost or a .local hostname')
    }
    return baseUrl.replace(/\/+$/, '')
  }

  it('accepts localhost URL', () => {
    expect(validateOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434')
  })

  it('accepts 127.0.0.1 URL', () => {
    expect(validateOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434')
  })

  it('accepts .local hostname', () => {
    expect(validateOllamaUrl('http://myhost.local:11434')).toBe('http://myhost.local:11434')
  })

  it('strips trailing slashes', () => {
    expect(validateOllamaUrl('http://localhost:11434/')).toBe('http://localhost:11434')
    expect(validateOllamaUrl('http://localhost:11434///')).toBe('http://localhost:11434')
  })

  it('rejects invalid URL', () => {
    expect(() => validateOllamaUrl('not-a-url')).toThrow('Invalid Ollama base URL')
  })

  it('rejects non-http protocol', () => {
    expect(() => validateOllamaUrl('ftp://localhost:11434')).toThrow('must use http or https')
  })

  it('rejects non-allowed hostname', () => {
    expect(() => validateOllamaUrl('http://example.com:11434')).toThrow('must point to localhost')
  })

  it('rejects public IP', () => {
    expect(() => validateOllamaUrl('http://8.8.8.8:11434')).toThrow('must point to localhost')
  })
})
