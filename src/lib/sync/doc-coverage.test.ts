import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDoc, getSyncDoc, getProvider, getAwareness, destroy } from './doc'

beforeEach(() => {
  destroy()
})

afterEach(() => {
  destroy()
})

describe('Sync doc coverage', () => {
  it('getDoc creates a Y.Doc instance', () => {
    const doc = getDoc()
    expect(doc).toBeDefined()
    expect(doc.guid).toBeDefined()
  })

  it('getDoc returns same instance on subsequent calls', () => {
    const doc1 = getDoc()
    const doc2 = getDoc()
    expect(doc1).toBe(doc2)
  })

  it('getSyncDoc returns sync doc with entities and claims maps', () => {
    const sync = getSyncDoc()
    expect(sync).toHaveProperty('entities')
    expect(sync).toHaveProperty('claims')
    expect(sync).toHaveProperty('meta')
  })

  it('getSyncDoc returns same instance on subsequent calls', () => {
    const sync1 = getSyncDoc()
    const sync2 = getSyncDoc()
    expect(sync1).toBe(sync2)
  })

  it('getProvider returns null initially', () => {
    expect(getProvider()).toBeNull()
  })

  it('getAwareness returns null initially', () => {
    expect(getAwareness()).toBeNull()
  })

  it('destroy cleans up all resources', () => {
    getDoc()
    getSyncDoc()
    destroy()
    // After destroy, new instances should be created
    const doc = getDoc()
    expect(doc).toBeDefined()
  })

  it('destroy is safe to call multiple times', () => {
    getDoc()
    destroy()
    destroy() // should not throw
    expect(true).toBe(true)
  })
})
