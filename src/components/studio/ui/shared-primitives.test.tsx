import { describe, it, expect } from 'vitest'

describe('EmptyState and Skeleton primitives', () => {
  it('EmptyState component exists and can be imported', async () => {
    const mod = await import('./shared-primitives')
    expect(mod.EmptyState).toBeDefined()
    expect(typeof mod.EmptyState).toBe('function')
  })

  it('Skeleton component exists and can be imported', async () => {
    const mod = await import('./shared-primitives')
    expect(mod.Skeleton).toBeDefined()
    expect(typeof mod.Skeleton).toBe('function')
  })

  it('components are named exports', async () => {
    const mod = await import('./shared-primitives')
    // Verify named exports (not default)
    expect(Object.keys(mod)).toContain('EmptyState')
    expect(Object.keys(mod)).toContain('Skeleton')
    expect('default' in mod).toBe(false)
  })
})

