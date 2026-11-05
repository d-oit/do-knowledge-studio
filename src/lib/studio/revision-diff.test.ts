import { describe, expect, it } from 'vitest'
import type { Entity } from './types'
import { MAX_DIFF_LINES, diffEntitySnapshots } from './revision-diff'

/** Entity fixture. */
const makeEntity = (overrides: Partial<Entity> = {}): Entity => ({
  id: 'entity-1',
  name: 'Note',
  type: 'note',
  description: '',
  content: 'alpha\nbeta\ngamma',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
  ...overrides,
})

describe('diffEntitySnapshots', () => {
  it('reports no change for identical snapshots', () => {
    const diff = diffEntitySnapshots(makeEntity(), makeEntity())
    expect(diff.fields).toEqual([])
    expect(diff.lines.every((line) => line.kind === 'same')).toBe(true)
    expect(diff.truncated).toBe(false)
  })

  it('reports metadata changes field by field', () => {
    const diff = diffEntitySnapshots(
      makeEntity(),
      makeEntity({ name: 'Renamed', tags: ['a'], sourceUrl: 'https://example.test' }),
    )
    expect(diff.fields.map((change) => change.field)).toEqual(['name', 'sourceUrl', 'tags'])
    expect(diff.fields[0]).toEqual({ field: 'name', before: 'Note', after: 'Renamed' })
  })

  it('marks lines the restore would re-add as removed and lines it would drop as added', () => {
    const revision = makeEntity({ content: 'alpha\nbeta\ngamma' })
    const current = makeEntity({ content: 'alpha\ndelta' })
    const diff = diffEntitySnapshots(revision, current)
    const removed = diff.lines.filter((line) => line.kind === 'removed').map((line) => line.text)
    const added = diff.lines.filter((line) => line.kind === 'added').map((line) => line.text)
    expect(removed).toContain('beta')
    expect(removed).toContain('gamma')
    expect(added).toContain('delta')
    expect(diff.lines.filter((line) => line.kind === 'same').map((line) => line.text)).toContain(
      'alpha',
    )
  })

  it('flags truncation for bodies longer than the diff window', () => {
    const long = Array.from({ length: MAX_DIFF_LINES + 10 }, (_, index) => `line ${index}`).join('\n')
    const diff = diffEntitySnapshots(makeEntity({ content: long }), makeEntity({ content: long }))
    expect(diff.truncated).toBe(true)
  })
})
