import { describe, it, expect } from 'vitest'
import { getAdapter } from './providers'

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
})
