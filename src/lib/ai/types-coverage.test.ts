import { describe, it, expect } from 'vitest'
import {
  PROVIDER_LABELS,
  OPENROUTER_DEFAULT_MODELS,
  OLLAMA_DEFAULT_MODELS,
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_BASE_URL,
  OPENROUTER_ROUTERS,
  OPENROUTER_MODELS,
  OPENROUTER_DEFAULT_TARGETS,
} from './types'

describe('AI types: constants', () => {
  it('PROVIDER_LABELS has openrouter and ollama', () => {
    expect(PROVIDER_LABELS).toHaveProperty('openrouter')
    expect(PROVIDER_LABELS).toHaveProperty('ollama')
  })

  it('OPENROUTER_DEFAULT_MODELS is a non-empty array', () => {
    expect(Array.isArray(OPENROUTER_DEFAULT_MODELS)).toBe(true)
    expect(OPENROUTER_DEFAULT_MODELS.length).toBeGreaterThan(0)
  })

  it('OLLAMA_DEFAULT_MODELS is a non-empty array', () => {
    expect(Array.isArray(OLLAMA_DEFAULT_MODELS)).toBe(true)
    expect(OLLAMA_DEFAULT_MODELS.length).toBeGreaterThan(0)
  })

  it('DEFAULT_MODEL is defined', () => {
    expect(DEFAULT_MODEL).toBeDefined()
  })

  it('DEFAULT_OLLAMA_BASE_URL is a valid URL', () => {
    const url = new URL(DEFAULT_OLLAMA_BASE_URL)
    expect(url.protocol).toMatch(/^https?:$/)
  })

  it('OPENROUTER_ROUTERS is a non-empty array', () => {
    expect(Array.isArray(OPENROUTER_ROUTERS)).toBe(true)
    expect(OPENROUTER_ROUTERS.length).toBeGreaterThan(0)
  })

  it('OPENROUTER_MODELS is a non-empty array', () => {
    expect(Array.isArray(OPENROUTER_MODELS)).toBe(true)
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0)
  })

  it('OPENROUTER_DEFAULT_TARGETS is a non-empty array', () => {
    expect(Array.isArray(OPENROUTER_DEFAULT_TARGETS)).toBe(true)
    expect(OPENROUTER_DEFAULT_TARGETS.length).toBeGreaterThan(0)
  })

  it('OPENROUTER_DEFAULT_TARGETS have required fields', () => {
    for (const target of OPENROUTER_DEFAULT_TARGETS) {
      expect(target).toHaveProperty('kind')
      expect(target).toHaveProperty('slug')
      expect(target).toHaveProperty('display_name')
    }
  })

  it('OPENROUTER_DEFAULT_MODELS are strings', () => {
    for (const model of OPENROUTER_DEFAULT_MODELS) {
      expect(typeof model).toBe('string')
      expect(model.length).toBeGreaterThan(0)
    }
  })

  it('OLLAMA_DEFAULT_MODELS are strings', () => {
    for (const model of OLLAMA_DEFAULT_MODELS) {
      expect(typeof model).toBe('string')
      expect(model.length).toBeGreaterThan(0)
    }
  })
})
