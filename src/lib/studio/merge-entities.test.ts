import { describe, it, expect, beforeEach } from 'vitest'
import { useStudioStore } from './store'
import { resolveWikilinkTarget } from '@/lib/editor/wikilinks'
import { seedEntities } from './seed-data'
import type { Entity } from './types'

describe('entity aliases', () => {
  it('resolves wikilinks by alias after exact name', () => {
    const entities: Entity[] = seedEntities.slice(0, 2)
    const first = entities[0]
    if (!first) return
    const withAlias = { ...first, aliases: ['Alpha Alias'] }
    const rest = entities.slice(1)
    expect(resolveWikilinkTarget('Alpha Alias', [withAlias, ...rest])).toBe(first.id)
  })

  it('prefers exact name over alias', () => {
    const entities: Entity[] = seedEntities.slice(0, 2)
    const [a, b] = entities
    if (!a || !b) return
    const aliased = { ...b, aliases: [a.name] }
    expect(resolveWikilinkTarget(a.name, [a, aliased])).toBe(a.id)
  })
})

describe('mergeEntities', () => {
  beforeEach(() => {
    useStudioStore.getState().resetStore()
  })

  it('merges loser into survivor and keeps loser name as alias', () => {
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    const loserName = b.name
    const ok = store.mergeEntities(a.id, b.id)
    expect(ok).toBe(true)
    const after = useStudioStore.getState()
    expect(after.entities.some((e) => e.id === b.id)).toBe(false)
    const survivor = after.entities.find((e) => e.id === a.id)
    expect(survivor?.aliases).toContain(loserName)
  })

  it('moves claims from loser to survivor with no dangling ids', () => {
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    store.mergeEntities(a.id, b.id)
    const after = useStudioStore.getState()
    const ids = new Set(after.entities.map((e) => e.id))
    expect(after.claims.every((c) => ids.has(c.entityId))).toBe(true)
  })

  it('returns false for same id or missing entities', () => {
    const store = useStudioStore.getState()
    const [a] = store.entities
    if (!a) return
    expect(store.mergeEntities(a.id, a.id)).toBe(false)
    expect(store.mergeEntities(a.id, 'missing-id')).toBe(false)
  })

  it('is undoable', () => {
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    const countBefore = useStudioStore.getState().entities.length
    store.mergeEntities(a.id, b.id)
    expect(useStudioStore.getState().entities.length).toBe(countBefore - 1)
    useStudioStore.getState().undo()
    expect(useStudioStore.getState().entities.length).toBe(countBefore)
  })
})
