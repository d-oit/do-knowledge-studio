import { describe, it, expect } from 'vitest'
import { getProviderEndpoint } from './ai-settings'

describe('getProviderEndpoint', () => {
  it('returns OpenAI endpoint', () => {
    expect(getProviderEndpoint('openai')).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('returns Anthropic endpoint', () => {
    expect(getProviderEndpoint('anthropic')).toBe('https://api.anthropic.com/v1/messages')
  })

  it('returns Ollama endpoint', () => {
    expect(getProviderEndpoint('ollama')).toBe('http://localhost:11434/api/chat')
  })
})
