import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH_FILTER } from './graph-query'
import type { GraphQuery } from './graph-query-builder'
import {
  MAX_SAVED_GRAPH_VIEWS,
  SavedGraphViewSchema,
  buildSavedGraphView,
  normalizeGraphViewName,
  removeSavedGraphView,
  upsertSavedGraphView,
  type SavedGraphView,
} from './graph-views'

/** A valid saved view with an overridable id and name. */
const makeView = (id: string, name = id): SavedGraphView => ({
  id,
  name,
  filter: EMPTY_GRAPH_FILTER,
  layout: 'force',
  focusMode: false,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  query: null,
  createdAt: '2026-11-05T00:00:00.000Z',
})

describe('saved graph views', () => {
  it('builds a view with an id, timestamp, and trimmed name', () => {
    const view = buildSavedGraphView({
      name: '  Verified people  ',
      filter: EMPTY_GRAPH_FILTER,
      layout: 'circular',
      focusMode: true,
      viewport: { panX: 12, panY: -8, zoom: 1.5 },
      // No visual query: the view stays on the legacy flat filter behavior.
      query: null,
    })
    expect(view.name).toBe('Verified people')
    expect(view.id).not.toBe('')
    expect(SavedGraphViewSchema.safeParse(view).success).toBe(true)
  })

  it('rejects a viewport outside the zoom range the canvas can render', () => {
    const view = makeView('v1')
    const outOfRange = { ...view, viewport: { ...view.viewport, zoom: 9 } }
    expect(SavedGraphViewSchema.safeParse(outOfRange).success).toBe(false)
  })

  it('caps the stored name length', () => {
    expect(normalizeGraphViewName('x'.repeat(200))).toHaveLength(60)
  })

  it('replaces an existing view with the same id and keeps newest first', () => {
    const views = [makeView('a'), makeView('b')]
    const updated = upsertSavedGraphView(views, { ...makeView('a'), name: 'Renamed' })
    expect(updated.map((view) => view.id)).toEqual(['a', 'b'])
    expect(updated[0]?.name).toBe('Renamed')
  })

  it('caps the number of stored views', () => {
    const views = Array.from({ length: MAX_SAVED_GRAPH_VIEWS }, (_, index) => makeView(`v${index}`))
    const next = upsertSavedGraphView(views, makeView('fresh'))
    expect(next).toHaveLength(MAX_SAVED_GRAPH_VIEWS)
    expect(next[0]?.id).toBe('fresh')
    expect(next.some((view) => view.id === `v${MAX_SAVED_GRAPH_VIEWS - 1}`)).toBe(false)
  })

  it('removes a view by id and leaves the rest untouched', () => {
    const views = [makeView('a'), makeView('b')]
    expect(removeSavedGraphView(views, 'a').map((view) => view.id)).toEqual(['b'])
    expect(removeSavedGraphView(views, 'missing')).toHaveLength(2)
  })

  it('round-trips a saved view with a visual query through the envelope schema', () => {
    const view: SavedGraphView = {
      ...makeView('q1'),
      query: {
        op: 'and',
        exclude: false,
        children: [
          { kind: 'entityType', value: 'person', exclude: false },
          { kind: 'claimStatus', value: 'verified', exclude: false },
        ],
      },
    }
    const parsed = SavedGraphViewSchema.safeParse(view)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.query).toEqual(view.query)
    expect(JSON.stringify(parsed.data)).toBe(JSON.stringify(view))
  })

  it('treats a legacy view without a query field as having no query', () => {
    const legacy = {
      id: 'legacy',
      name: 'legacy',
      filter: EMPTY_GRAPH_FILTER,
      layout: 'force',
      focusMode: false,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      createdAt: '2026-11-05T00:00:00.000Z',
    }
    const parsed = SavedGraphViewSchema.safeParse(legacy)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.query).toBeNull()
  })

  it('builds a saved view carrying the active query', () => {
    const query: GraphQuery = {
      op: 'or',
      exclude: false,
      children: [{ kind: 'tag', value: 'triz', exclude: false }],
    }
    const view = buildSavedGraphView({
      name: 'TRIZ view',
      filter: EMPTY_GRAPH_FILTER,
      layout: 'force',
      focusMode: false,
      viewport: { panX: 0, panY: 0, zoom: 1 },
      query,
    })
    expect(view.query).toEqual(query)
    expect(SavedGraphViewSchema.safeParse(view).success).toBe(true)
  })
})
