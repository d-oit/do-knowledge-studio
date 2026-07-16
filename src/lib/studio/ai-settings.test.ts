import { describe, it, expect } from 'vitest'
import { getProviderEndpoint } from './ai-settings'

describe('getProviderEndpoint', () => {
  it('returns OpenRouter endpoint', () => {
    expect(getProviderEndpoint('openrouter')).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('returns Ollama endpoint', () => {
    expect(getProviderEndpoint('ollama')).toBe('http://localhost:11434/api/chat')
  })
})
