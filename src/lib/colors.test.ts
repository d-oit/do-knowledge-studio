import { describe, it, expect } from 'vitest'
import { PEER_COLORS, EXPORT_COLORS, CANVAS_FALLBACK_BACKGROUND } from './colors'

describe('shared color module (#853)', () => {
  it('assigns each peer a distinct color', () => {
    expect(new Set(PEER_COLORS).size).toBe(PEER_COLORS.length)
  })

  it('exposes the whole peer palette as hex values', () => {
    for (const color of PEER_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('keeps the export palette and canvas fallback as hex values', () => {
    for (const value of Object.values(EXPORT_COLORS)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
    }
    expect(CANVAS_FALLBACK_BACKGROUND).toMatch(/^#[0-9a-f]{6}$/i)
    // The canvas fallback mirrors the light `--background` token.
    expect(CANVAS_FALLBACK_BACKGROUND).toBe(EXPORT_COLORS.background)
  })
})
