/**
 * Regression tests for the pre-import backup outcome (Plan 162 #1).
 *
 * Before this change `persistRecoverySnapshot` returned `void` and silently
 * skipped the write above the 4 MiB guard, leaving any earlier snapshot in
 * place, while `importWithRollback` still reported `{ success: true }`. The
 * library was replaced with no way back and no indication anything was
 * missing. These tests pin the observable behavior that replaced that.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  describeRecoverySnapshot,
  persistRecoverySnapshot,
  restoreFromRecovery,
  subscribeToRecoveryAvailability,
  type RecoverySnapshot,
} from './recovery-helpers'
import { useStudioStore } from './store'
import type { Entity } from './types'

const RECOVERY_KEY = 'do-knowledge-studio-recovery'

/** Serialized bytes the 4 MiB guard compares against. */
const MAX_RECOVERY_SIZE_BYTES = 4 * 1024 * 1024

const makeEntity = (id: string, name: string): Entity => ({
  id,
  name,
  type: 'concept',
  description: '',
  content: '',
  tags: [],
  links: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const smallSnapshot = (id: string, name: string): RecoverySnapshot => ({
  entities: [makeEntity(id, name)],
  claims: [],
  entityHistory: [{ entities: [makeEntity(id, name)], claims: [] }],
  historyIndex: 0,
  graph: undefined,
  mindMap: undefined,
  links: undefined,
  tags: undefined,
})

/** A snapshot whose serialized form is comfortably past the 4 MiB guard. */
const oversizedSnapshot = (): RecoverySnapshot => ({
  ...smallSnapshot('big-1', 'Big'),
  entities: [
    { ...makeEntity('big-1', 'Big'), content: 'x'.repeat(MAX_RECOVERY_SIZE_BYTES + 1) },
  ],
})

/**
 * Spies scoped to a single test, torn down in `afterEach`.
 *
 * Two environment facts force this shape. JSDOM's `localStorage` bypasses
 * `Storage.prototype`, so a prototype spy never fires. And Vitest's
 * `restoreMocks` does not restore a spy placed on an instance, so such a spy
 * outlives `vi.restoreAllMocks()` and poisons every later test — which is
 * exactly how an earlier draft of this file produced phantom failures in an
 * unrelated suite.
 */
const scopedSpies: MockInstance[] = []

/** Simulates the browser refusing to store the recovery snapshot. */
const refuseRecoveryWrite = (): void => {
  // Keep every other key (Zustand's persistence, for example) writing to the
  // real store: a mock that swallows unrelated writes turns later assertions
  // into fiction (GitNexus on PR #925).
  //
  // Delegation cannot go through a captured original or the prototype: jsdom
  // re-dispatches the call through the instance property, so either route
  // recurses into this spy. The write therefore happens with the spy stepped
  // aside — and because `mockRestore()` *removes* the spy, the refusal has to be
  // reinstalled afterwards with a fresh `vi.spyOn`. Re-implementing the restored
  // spy would only mutate a detached function, which silently let every recovery
  // write after the first non-recovery one succeed (GitNexus on PR #925).
  let live: ReturnType<typeof vi.spyOn> | null = null

  const install = (): void => {
    live = vi.spyOn(localStorage, 'setItem').mockImplementation(impl)
    scopedSpies.push(live)
  }

  const impl = (key: string, value: string): void => {
    if (key === RECOVERY_KEY) throw new Error('QuotaExceededError')
    live?.mockRestore()
    live = null
    try {
      localStorage.setItem(key, value)
    } finally {
      install()
    }
  }

  install()
}

/** Simulates storage refusing every write. */
const refuseEveryWrite = (): void => {
  scopedSpies.push(
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    }),
  )
}

/** Simulates storage refusing every read (blocked site data, `SecurityError`). */
const refuseReads = (): void => {
  scopedSpies.push(
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    }),
  )
}

/** Simulates storage refusing the snapshot removal. */
const refuseClear = (): void => {
  scopedSpies.push(
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    }),
  )
}

/** Restores every scoped spy, e.g. to assert on real storage mid-test. */
const restoreScopedSpies = (): void => {
  for (const spy of scopedSpies.splice(0)) spy.mockRestore()
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  restoreScopedSpies()
})

describe('persistRecoverySnapshot', () => {
  it('reports a write that actually happened', () => {
    const result = persistRecoverySnapshot(smallSnapshot('a', 'A'))

    expect(result).toEqual({ persisted: true })
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
  })

  it('reports the skip when the snapshot exceeds the size guard', () => {
    const result = persistRecoverySnapshot(oversizedSnapshot())

    expect(result).toEqual({ persisted: false, reason: 'too-large' })
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it('reports a refused clear as a storage refusal, not as oversized', () => {
    // The oversized path clears the snapshot so a later restore cannot hand
    // back the previous corpus. Storage can refuse that removal; the outcome
    // must then say so instead of claiming the previous library is gone
    // (GitNexus on PR #925).
    localStorage.setItem(RECOVERY_KEY, 'stale-previous-corpus')
    scopedSpies.push(
      vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      }),
    )

    const result = persistRecoverySnapshot(oversizedSnapshot())

    expect(result).toEqual({ persisted: false, reason: 'storage-unavailable' })
    // Documented policy for hostile storage: the stale-but-real copy survives.
    restoreScopedSpies()
    expect(localStorage.getItem(RECOVERY_KEY)).toBe('stale-previous-corpus')
  })

  it('measures the size guard in bytes, not UTF-16 code units', () => {
    // 3M non-ASCII characters are 3M UTF-16 code units (under the 4 MiB
    // code-unit reading of the guard) but 6M UTF-8 bytes (over it). The
    // snapshot must be refused — a code-unit check would wave it through and
    // the write would then fail in storage anyway, without the protective
    // clear (GitNexus on PR #925).
    // The string appears ONCE (entities only, no history copy): 3M UTF-16 code
    // units stay under the 4 MiB code-unit reading, while 6M UTF-8 bytes exceed
    // it. Duplicating it through `smallSnapshot` put the code-unit length over
    // the guard as well, so the old check would have refused it too and the test
    // proved nothing about the unit being measured (review on #925).
    const unicodeHeavy = 'é'.repeat(3_000_000)
    const result = persistRecoverySnapshot({
      entities: [makeEntity('a', unicodeHeavy)],
      claims: [],
      entityHistory: [],
      historyIndex: 0,
      graph: undefined,
      mindMap: undefined,
      links: undefined,
      tags: undefined,
    })

    expect(result).toEqual({ persisted: false, reason: 'too-large' })
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it('reports serialization failure as its own reason, not as oversized', () => {
    // Circular state makes JSON.stringify throw before anything is measured.
    // Calling that 'too-large' told users their library was too big when no
    // size was ever known (GitNexus on PR #925).
    // A stale snapshot is seeded first: the import proceeds either way, so what
    // must not survive is the previous corpus's snapshot.
    localStorage.setItem(RECOVERY_KEY, 'stale-previous-corpus')
    const circular = smallSnapshot('a', 'A')
    ;(circular as unknown as { self: unknown }).self = circular

    const result = persistRecoverySnapshot(circular)

    expect(result).toEqual({ persisted: false, reason: 'unserializable' })
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it('reports a refused clear of an unserializable import as a storage refusal', () => {
    localStorage.setItem(RECOVERY_KEY, 'stale-previous-corpus')
    scopedSpies.push(
      vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      }),
    )
    const circular = smallSnapshot('a', 'A')
    ;(circular as unknown as { self: unknown }).self = circular

    const result = persistRecoverySnapshot(circular)

    expect(result).toEqual({ persisted: false, reason: 'storage-unavailable' })
    restoreScopedSpies()
    expect(localStorage.getItem(RECOVERY_KEY)).toBe('stale-previous-corpus')
  })

  it('contains a throwing availability subscriber and still reports success', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unsubscribe = subscribeToRecoveryAvailability(() => {
      throw new Error('listener bug')
    })
    try {
      const result = persistRecoverySnapshot(smallSnapshot('a', 'A'))

      // The write happened; a listener bug must neither abort the caller nor
      // be relabelled a storage failure (GitNexus on PR #925).
      expect(result).toEqual({ persisted: true })
      expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        'Recovery availability subscriber threw',
        expect.any(Error),
      )
    } finally {
      unsubscribe()
    }
  })

  it('clears a stale snapshot when the write is skipped', () => {
    // A snapshot from an earlier import is sitting in storage.
    persistRecoverySnapshot(smallSnapshot('old', 'Old corpus'))
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()

    persistRecoverySnapshot(oversizedSnapshot())

    // Leaving this behind would let a later restore hand back a corpus the
    // user replaced one import ago.
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
    expect(describeRecoverySnapshot()).toBeNull()
  })

  it('reports storage refusal without destroying the snapshot already stored', () => {
    // Corpus A's snapshot is the only recoverable copy of the library the
    // import is about to replace.
    persistRecoverySnapshot(smallSnapshot('old', 'Old corpus'))
    refuseRecoveryWrite()

    const result = persistRecoverySnapshot(smallSnapshot('new', 'New corpus'))

    expect(result).toEqual({ persisted: false, reason: 'storage-unavailable' })

    // `removeItem` still works when `setItem` is refused by a full quota, so a
    // naive clear here would delete the only copy of corpus A. A stale-but-real
    // backup must survive: the restore path re-validates it on every read.
    expect(describeRecoverySnapshot()).toEqual({ entityCount: 1, claimCount: 0 })
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
  })

  it('reports storage refusal rather than claiming success', () => {
    refuseEveryWrite()

    const result = persistRecoverySnapshot(smallSnapshot('a', 'A'))

    expect(result).toEqual({ persisted: false, reason: 'storage-unavailable' })
  })

  it('reports a skipped backup instead of a clean success', () => {
    refuseRecoveryWrite()

    const result = useStudioStore
      .getState()
      .importWithRollback([makeEntity('imported', 'Imported')], [])

    // The import genuinely happened — the library changed.
    expect(useStudioStore.getState().entities.map((e) => e.id)).toContain('imported')
    // ...but the caller is told there is no way back.
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.backupPersisted).toBe(false)
      expect(result.backupFailure).toBe('storage-unavailable')
    }
  })
})

describe('describeRecoverySnapshot', () => {
  it('returns null when nothing is stored', () => {
    expect(describeRecoverySnapshot()).toBeNull()
  })

  it('summarizes a restorable snapshot without applying it', () => {
    persistRecoverySnapshot({
      ...smallSnapshot('a', 'A'),
      entities: [makeEntity('a', 'A'), makeEntity('b', 'B')],
    })

    expect(describeRecoverySnapshot()).toEqual({ entityCount: 2, claimCount: 0 })
    // Describing must not consume the snapshot.
    expect(describeRecoverySnapshot()).toEqual({ entityCount: 2, claimCount: 0 })
  })

  it('returns null for an expired snapshot instead of advertising it', () => {
    persistRecoverySnapshot(smallSnapshot('a', 'A'))
    const stored = localStorage.getItem(RECOVERY_KEY)
    if (!stored) throw new Error('snapshot was not persisted')

    // Backdate past the 24h TTL.
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null || !('timestamp' in parsed)) {
      throw new Error('unexpected snapshot envelope')
    }
    localStorage.setItem(
      RECOVERY_KEY,
      JSON.stringify({ ...parsed, timestamp: Date.now() - 25 * 60 * 60 * 1000 }),
    )

    expect(describeRecoverySnapshot()).toBeNull()
    // The restore path and the banner must agree, so the stale copy is dropped.
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })

  it('survives a corrupt snapshot instead of throwing into the shell', () => {
    // Unparseable bytes left by an interrupted write. `describeRecoverySnapshot`
    // runs from an effect in the app shell, so a throw here would take the whole
    // workspace down over an unrelated leftover backup.
    localStorage.setItem(RECOVERY_KEY, 'not json at all')

    expect(() => describeRecoverySnapshot()).not.toThrow()
    expect(describeRecoverySnapshot()).toBeNull()
  })
})

describe('restoreFromRecovery safety', () => {
  it('never throws when storage reads fail', () => {
    persistRecoverySnapshot(smallSnapshot('a', 'A'))
    refuseReads()

    expect(() => describeRecoverySnapshot()).not.toThrow()
    expect(() => restoreFromRecovery()).not.toThrow()
  })

  it('does not delete the snapshot when storage is simply unreadable', () => {
    persistRecoverySnapshot(smallSnapshot('a', 'A'))
    refuseReads()

    const result = restoreFromRecovery()

    expect(result.success).toBe(false)
    // Unreadable storage is not evidence of bad bytes, so a later attempt —
    // after the user frees space or re-allows site data — must still find it.
    restoreScopedSpies()
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
  })

  it('reports that a successful restore really cleared the snapshot', () => {
    persistRecoverySnapshot(smallSnapshot('a', 'A'))

    const result = restoreFromRecovery()

    expect(result).toEqual({ success: true, snapshotCleared: true })
    expect(localStorage.getItem(RECOVERY_KEY)).toBeNull()
  })
  it('preserves canvas in undo history through the recovery storage round-trip', () => {
    const original = smallSnapshot('a', 'A')
    const canvas = {
      graph: {
        nodes: [{ id: 'a', label: 'A', type: 'concept' as const, x: 0, y: 0 }],
        edges: [{ id: 'g1', source: 'a', target: 'a', relation: 'self' }],
      },
      links: [{ id: 'l1', sourceId: 'a', targetId: 'a', type: 'self', createdAt: '2026-01-01T00:00:00.000Z' }],
    }
    const snapshot: RecoverySnapshot = {
      ...original,
      entityHistory: [{ ...original.entityHistory[0], canvas }],
    }
    expect(persistRecoverySnapshot(snapshot)).toEqual({ persisted: true })

    const result = restoreFromRecovery()

    expect(result).toEqual({ success: true, snapshotCleared: true })
    expect(useStudioStore.getState().entityHistory[0]?.canvas).toEqual(canvas)
  })

  it('prunes dangling current canvas when restoring a recovery snapshot', () => {
    const graph = {
      nodes: [
        { id: 'a', label: 'A', type: 'concept' as const, x: 0, y: 0 },
        { id: 'standalone', label: 'Standalone', type: 'concept' as const, x: 1, y: 1 },
      ],
      edges: [
        { id: 'keep', source: 'a', target: 'a', relation: 'self' },
        { id: 'drop', source: 'a', target: 'missing', relation: 'dangling' },
      ],
    } satisfies NonNullable<RecoverySnapshot['graph']>
    const mindMap = {
      nodes: [
        { id: 'a', label: 'A', type: 'concept' as const },
        { id: 'standalone', label: 'Standalone', type: 'concept' as const },
      ],
      edges: [
        { id: 'keep', source: 'a', target: 'a', relation: 'self' },
        { id: 'drop', source: 'missing', target: 'a', relation: 'dangling' },
      ],
    } satisfies NonNullable<RecoverySnapshot['mindMap']>
    const links = [
      { id: 'keep', sourceId: 'a', targetId: 'a', type: 'self', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'drop', sourceId: 'a', targetId: 'missing', type: 'dangling', createdAt: '2026-01-01T00:00:00.000Z' },
    ] satisfies NonNullable<RecoverySnapshot['links']>

    expect(persistRecoverySnapshot({ ...smallSnapshot('a', 'A'), graph, mindMap, links })).toEqual({
      persisted: true,
    })
    expect(restoreFromRecovery()).toEqual({ success: true, snapshotCleared: true })

    const state = useStudioStore.getState()
    expect(state.graph?.nodes.map((node) => node.id)).toEqual(['a', 'standalone'])
    expect(state.graph?.edges.map((edge) => edge.id)).toEqual(['keep'])
    expect(state.mindMap?.nodes.map((node) => node.id)).toEqual(['a', 'standalone'])
    expect(state.mindMap?.edges.map((edge) => edge.id)).toEqual(['keep'])
    expect(state.links?.map((link) => link.id)).toEqual(['keep'])
  })


  it('reports an un-cleared snapshot when the removal is refused after the restore lands', () => {
    // The restore applies in memory, then storage refuses the removal. The
    // corpus is back but the backup survives, so `describeRecoverySnapshot`
    // will offer it again on the next load — a second restore could then
    // overwrite the corpus the user just restored, plus any edits since.
    // Reporting `{ success: true }` alone would hide that (GitNexus on PR #925).
    persistRecoverySnapshot(smallSnapshot('a', 'A'))
    refuseClear()

    const result = restoreFromRecovery()

    expect(result).toEqual({ success: true, snapshotCleared: false })
    // The swap did land …
    expect(useStudioStore.getState().entities).toHaveLength(1)
    // … and the refusal is what leaves the offer alive for a later load.
    restoreScopedSpies()
    expect(describeRecoverySnapshot()).toEqual({ entityCount: 1, claimCount: 0 })
  })

  it('keeps the snapshot when applying it fails, so a retry stays possible', () => {
    persistRecoverySnapshot(smallSnapshot('a', 'A'))

    // Applying swaps the store in memory then persists; a full quota throws
    // after the swap. The backup is the only way back, so it must survive.
    // The mock calls through before throwing: throwing up front would never
    // change the store and would not exercise the documented failure — the
    // one where the corpus is already swapped when the write is refused
    // (GitNexus on PR #925).
    const originalSetState = useStudioStore.setState.bind(useStudioStore)
    scopedSpies.push(
      vi.spyOn(useStudioStore, 'setState').mockImplementation(
        (partial: Parameters<typeof useStudioStore.setState>[0]) => {
          originalSetState(partial)
          throw new Error('QuotaExceededError')
        },
      ),
    )

    const result = restoreFromRecovery()

    expect(result.success).toBe(false)
    // The swap did land (that is what makes this the hard case) …
    expect(useStudioStore.getState().entities).toHaveLength(1)
    // … and the only copy of the replaced corpus is still restorable.
    expect(localStorage.getItem(RECOVERY_KEY)).not.toBeNull()
  })
})