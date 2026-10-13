import { describe, expect, it } from 'vitest'
import { isKnownViewHash, parseViewHash, viewToHash } from './view-hash'
import { VIEW_IDS } from './types'

describe('view hash helpers', () => {
  it('round-trips every supported view through its canonical hash', () => {
    for (const view of VIEW_IDS) {
      const hash = viewToHash(view)
      expect(hash).toBe(`#/${view}`)
      expect(parseViewHash(hash)).toBe(view)
      expect(isKnownViewHash(hash)).toBe(true)
    }
  })

  it.each(['', '#', '#main-content'])('does not route non-view hash %j', (hash) => {
    expect(parseViewHash(hash)).toBeNull()
    expect(isKnownViewHash(hash)).toBe(false)
  })

  it.each(['#/', '#/not-a-view'])('resolves unknown route %s to home', (hash) => {
    expect(parseViewHash(hash)).toBe('home')
    expect(isKnownViewHash(hash)).toBe(false)
  })
})
