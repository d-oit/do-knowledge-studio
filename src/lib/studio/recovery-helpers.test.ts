import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildRecoverySnapshot,
  persistRecoverySnapshot,
  readRecoverySnapshot,
  type RecoverySnapshot,
} from './recovery-helpers'

const makeSnapshot = (): RecoverySnapshot => ({
  entities: [],
  claims: [],
  entityHistory: [],
  historyIndex: -1,
})

describe('persistRecoverySnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists and reads back a snapshot', () => {
    const result = persistRecoverySnapshot(makeSnapshot())
    expect(result.persisted).toBe(true)
    const read = readRecoverySnapshot()
    expect(read.ok).toBe(true)
  })

  it('returns corrupt (not throw) on invalid JSON', () => {
    localStorage.setItem('do-knowledge-studio-recovery', '{not-json')
    const read = readRecoverySnapshot()
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.error).toContain('corrupt')
  })

  it('returns empty when nothing is stored', () => {
    const read = readRecoverySnapshot()
    expect(read.ok).toBe(false)
    if (!read.ok) expect(read.error).toContain('No recovery snapshot')
  })

  it('rejects oversized payloads fail-closed', () => {
    const big = makeSnapshot()
    big.entities = [
      {
        id: 'e1',
        name: 'x'.repeat(5 * 1024 * 1024),
        type: 'note',
        description: '',
        content: '',
        tags: [],
        links: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const result = persistRecoverySnapshot(big)
    expect(result.persisted).toBe(false)
  })
})

describe('buildRecoverySnapshot', () => {
  it('builds a snapshot from store state shape', () => {
    const snapshot = buildRecoverySnapshot({
      entities: [],
      claims: [],
      entityHistory: [],
      historyIndex: -1,
    })
    expect(snapshot.entities).toEqual([])
    expect(snapshot.historyIndex).toBe(-1)
  })
})
