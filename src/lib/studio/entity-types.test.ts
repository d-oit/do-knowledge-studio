import { afterEach, describe, expect, it, vi } from 'vitest'
import { Map } from 'lucide-react'
import {
  getEntityTypeDefs,
  getEntityTypeMeta,
  registerEntityType,
  resetCustomEntityTypes,
  type EntityTypeDef,
} from './entity-types'
import { ENTITY_TYPE_META } from './types'

/** Valid custom def used across tests. */
const CUSTOM_DEF: EntityTypeDef = {
  id: 'roadmap',
  label: 'Roadmap',
  color: 'violet',
  bg: 'bg-violet-100 dark:bg-violet-950/40',
  text: 'text-violet-700 dark:text-violet-300',
  dot: 'bg-violet-500',
}

afterEach(() => {
  resetCustomEntityTypes()
})

describe('getEntityTypeDefs', () => {
  it('lists the four built-in types in canonical order', () => {
    const defs = getEntityTypeDefs()
    expect(defs.map((d) => d.id)).toEqual(['note', 'concept', 'person', 'project'])
  })

  it('built-in defs match ENTITY_TYPE_META values', () => {
    const defs = getEntityTypeDefs()
    for (const def of defs) {
      expect(def.label).toBe(ENTITY_TYPE_META[def.id as keyof typeof ENTITY_TYPE_META].label)
      expect(def.dot).toBe(ENTITY_TYPE_META[def.id as keyof typeof ENTITY_TYPE_META].dot)
    }
  })

  it('appends registered customs after built-ins', () => {
    registerEntityType(CUSTOM_DEF)
    expect(getEntityTypeDefs().map((d) => d.id)).toEqual([
      'note',
      'concept',
      'person',
      'project',
      'roadmap',
    ])
  })

  it('returns a fresh array each call (callers may mutate safely)', () => {
    const first = getEntityTypeDefs()
    const second = getEntityTypeDefs()
    expect(first).not.toBe(second)
  })
})

describe('registerEntityType', () => {
  it('is idempotent by id: re-registering replaces without duplicating', () => {
    registerEntityType(CUSTOM_DEF)
    registerEntityType({ ...CUSTOM_DEF, label: 'Roadmap v2' })
    const defs = getEntityTypeDefs()
    expect(defs.filter((d) => d.id === 'roadmap')).toHaveLength(1)
    expect(getEntityTypeMeta('roadmap').label).toBe('Roadmap v2')
  })

  it('records insertion order for multiple customs', () => {
    registerEntityType(CUSTOM_DEF)
    registerEntityType({ ...CUSTOM_DEF, id: 'milestone', label: 'Milestone' })
    expect(getEntityTypeDefs().map((d) => d.id)).toEqual([
      'note',
      'concept',
      'person',
      'project',
      'roadmap',
      'milestone',
    ])
  })

  it('throws on invalid definitions', () => {
    // @ts-expect-error -- intentionally invalid: missing required fields
    expect(() => registerEntityType({ id: 'x' })).toThrow()
    expect(() => registerEntityType({ ...CUSTOM_DEF, id: '' })).toThrow()
    expect(() => registerEntityType({ ...CUSTOM_DEF, id: '   ' })).toThrow()
    expect(() => registerEntityType({ ...CUSTOM_DEF, id: 'x'.repeat(65) })).toThrow()
    expect(() => registerEntityType({ ...CUSTOM_DEF, label: '' })).toThrow()
  })

  it('refuses to override built-in ids', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let called = false
    try {
      registerEntityType({ ...CUSTOM_DEF, id: 'note' })
      called = spy.mock.calls.length > 0
    } finally {
      spy.mockRestore()
    }
    expect(called).toBe(true)
    expect(getEntityTypeMeta('note').label).toBe(ENTITY_TYPE_META.note.label)
  })
})

describe('resetCustomEntityTypes', () => {
  it('clears registered customs but keeps built-ins', () => {
    registerEntityType(CUSTOM_DEF)
    resetCustomEntityTypes()
    expect(getEntityTypeDefs().map((d) => d.id)).toEqual(['note', 'concept', 'person', 'project'])
  })
})

describe('getEntityTypeMeta', () => {
  it('resolves registered custom defs', () => {
    registerEntityType(CUSTOM_DEF)
    expect(getEntityTypeMeta('roadmap')).toEqual(expect.objectContaining({
      label: 'Roadmap',
      dot: 'bg-violet-500',
      bg: 'bg-violet-100 dark:bg-violet-950/40',
      text: 'text-violet-700 dark:text-violet-300',
    }))
  })

  it('returns custom meta with an icon when provided', () => {
    registerEntityType({ ...CUSTOM_DEF, icon: Map })
    expect(getEntityTypeMeta('roadmap').icon).toBe(Map)
  })

  it('resolves built-ins to ENTITY_TYPE_META values', () => {
    for (const id of ['note', 'concept', 'person', 'project'] as const) {
      const meta = getEntityTypeMeta(id)
      expect(meta.label).toBe(ENTITY_TYPE_META[id].label)
      expect(meta.dot).toBe(ENTITY_TYPE_META[id].dot)
    }
  })

  it('falls back to a neutral default for unknown types without throwing', () => {
    const meta = getEntityTypeMeta('foreign-type')
    expect(meta.label).toBe('foreign-type')
    expect(meta.color).toBe('neutral')
    expect(meta.dot).toContain('zinc')
    expect(meta.bg).toContain('zinc')
    expect(meta.text).toContain('zinc')
    // Icon resolution is the renderer's job (EntityIcon falls back to a neutral icon).
    expect(meta.icon).toBeUndefined()
  })

  it('never throws for arbitrary strings', () => {
    for (const t of ['', 'a b c', 'X'.repeat(200), 'emoji 🎯 type', 'UPPER']) {
      expect(() => getEntityTypeMeta(t)).not.toThrow()
    }
  })
})