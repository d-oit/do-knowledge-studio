import { describe, it, expect, beforeEach } from 'vitest'
import { useStudioStore } from './store'
import { resolveWikilinkTarget } from '@/lib/editor/wikilinks'
import { seedEntities } from './seed-data'
import { buildJsonExport } from '@/components/studio/views/export-helpers'
import type { Claim, Entity } from './types'

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

  /** Controlled corpus with survivor s, loser l, and unrelated u. */
  const makeControlledEntities = (): Entity[] => [
    {
      id: 's',
      name: 'Survivor',
      type: 'note',
      description: '',
      content: 'sv content',
      tags: [],
      aliases: ['SA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [],
    },
    {
      id: 'l',
      name: 'Loser',
      type: 'note',
      description: '',
      content: 'lz content',
      tags: ['lt'],
      aliases: ['LA'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [
        { targetId: 's', relation: 'back' },
        { targetId: 'u', relation: 'peer' },
      ],
    },
    {
      id: 'u',
      name: 'Unrelated',
      type: 'note',
      description: '',
      content: 'un content',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      links: [{ targetId: 'l', relation: 'points' }],
    },
  ]

  it('does not overwrite an intervening edit to the survivor', () => {
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    // An edit lands while the merge is in flight (e.g. a cross-tab or sync
    // write). The merge must build from this latest state, not from a
    // pre-edit snapshot, so the intervening change survives.
    useStudioStore.setState({
      entities: useStudioStore.getState().entities.map((e) =>
        e.id === a.id ? { ...e, content: 'interim edit', aliases: ['Interim Alias'] } : e,
      ),
    })
    expect(useStudioStore.getState().mergeEntities(a.id, b.id)).toBe(true)
    const survivor = useStudioStore.getState().entities.find((e) => e.id === a.id)
    expect(survivor?.content).toBe('interim edit')
    expect(survivor?.aliases).toContain('Interim Alias')
    expect(survivor?.aliases).toContain(b.name.trim())
  })

  it('combines aliases case-insensitively and keeps survivor order', () => {
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    useStudioStore.setState({
      entities: useStudioStore.getState().entities.map((e) => {
        if (e.id === a.id) return { ...e, aliases: ['Survivor Alias', 'shared'] }
        if (e.id === b.id) return { ...e, aliases: ['Loser Alias', 'SHARED'] }
        return e
      }),
    })
    useStudioStore.getState().mergeEntities(a.id, b.id)
    const survivor = useStudioStore.getState().entities.find((e) => e.id === a.id)
    expect(survivor?.aliases).toEqual(['Survivor Alias', 'shared', b.name.trim(), 'Loser Alias'])
  })

  it('dedupes aliases with resolver normalization and retains exact survivor spelling', () => {
    useStudioStore.getState().resetStore()
    const [a, b] = useStudioStore.getState().entities
    if (!a || !b) return
    useStudioStore.setState({
      entities: useStudioStore.getState().entities.map((e) => {
        if (e.id === a.id) return { ...e, aliases: [' SPACED ', 'Case Name'] }
        if (e.id === b.id) return { ...e, aliases: ['spaced', 'case name '] }
        return e
      }),
    })
    useStudioStore.getState().mergeEntities(a.id, b.id)
    const survivor = useStudioStore.getState().entities.find((e) => e.id === a.id)
    // The loser's `spaced`/`case name ` are equivalent after the resolver's
    // `trim().toLowerCase()` normalization, so they are not appended, and the
    // survivor's exact stored spelling is preserved.
    expect(survivor?.aliases).toEqual([' SPACED ', 'Case Name', b.name.trim()])
  })
  it('remaps loser references and preserves unrelated entity state', () => {
    useStudioStore.getState().resetStore()
    useStudioStore.setState({ entities: makeControlledEntities() })
    expect(useStudioStore.getState().mergeEntities('s', 'l')).toBe(true)
    const after = useStudioStore.getState()
    expect(after.entities.some((e) => e.id === 'l')).toBe(false)
    const survivor = after.entities.find((e) => e.id === 's')
    const unrelated = after.entities.find((e) => e.id === 'u')
    expect(survivor?.aliases).toEqual(['SA', 'Loser', 'LA'])
    expect(survivor?.tags).toEqual(['lt'])
    expect(survivor?.content).toBe('sv content')
    // Loser's link to the survivor is dropped; its link to an unrelated
    // entity is kept as-is.
    expect(survivor?.links).toEqual([{ targetId: 'u', relation: 'peer' }])
    // The unrelated entity's link to the loser is remapped to the survivor,
    // and its own fields are untouched.
    expect(unrelated?.links).toEqual([{ targetId: 's', relation: 'points' }])
    expect(unrelated?.content).toBe('un content')
    expect(after.entities.every((e) => e.links.every((l) => l.targetId !== 'l'))).toBe(true)
  })

  it('undo restores the pre-merge alias state', () => {
    useStudioStore.getState().resetStore()
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    store.commitEntity({ ...a, aliases: ['Original Alias'] })
    expect(useStudioStore.getState().mergeEntities(a.id, b.id)).toBe(true)
    useStudioStore.getState().undo()
    const survivor = useStudioStore.getState().entities.find((e) => e.id === a.id)
    expect(survivor?.aliases).toEqual(['Original Alias'])
    expect(useStudioStore.getState().entities.some((e) => e.id === b.id)).toBe(true)
  })

  it('round-trips the merged corpus through export/import retaining aliases', () => {
    useStudioStore.getState().resetStore()
    const store = useStudioStore.getState()
    const [a, b] = store.entities
    if (!a || !b) return
    useStudioStore.setState({
      entities: useStudioStore.getState().entities.map((e) =>
        e.id === a.id ? { ...e, aliases: ['Pre-Merge Alias'] } : e,
      ),
    })
    useStudioStore.getState().mergeEntities(a.id, b.id)
    const merged = useStudioStore.getState()
    const payload = JSON.parse(buildJsonExport(merged.entities, merged.claims)) as {
      entities: Entity[]
      claims: Claim[]
    }
    useStudioStore.getState().importData(payload.entities, payload.claims)
    const after = useStudioStore.getState()
    expect(after.entities).toEqual(merged.entities)
    expect(after.claims).toEqual(merged.claims)
    const survivor = after.entities.find((e) => e.id === a.id)
    expect(survivor?.aliases).toContain('Pre-Merge Alias')
    expect(survivor?.aliases).toContain(b.name.trim())
  })
})
