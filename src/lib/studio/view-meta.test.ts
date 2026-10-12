import { describe, it, expect } from 'vitest'
import { VIEW_META, getViewMeta } from './view-meta'
import type { ViewId } from './types'

const ALL_VIEWS: ViewId[] = [
  'home',
  'editor',
  'library',
  'timeline',
  'graph',
  'mindmap',
  'chat',
  'ai',
  'triz',
  'export',
  'sync',
]

describe('VIEW_META (#865 single source for view labels/titles/subtitles)', () => {
  it('covers every view id', () => {
    for (const id of ALL_VIEWS) {
      expect(VIEW_META.has(id)).toBe(true)
    }
    expect(VIEW_META.size).toBe(ALL_VIEWS.length)
  })

  it('gives every view a non-empty label, title and subtitle', () => {
    for (const id of ALL_VIEWS) {
      const meta = VIEW_META.get(id)
      expect(meta).toBeDefined()
      expect(meta?.label.trim().length ?? 0).toBeGreaterThan(0)
      expect(meta?.title.trim().length ?? 0).toBeGreaterThan(0)
      expect(meta?.subtitle.trim().length ?? 0).toBeGreaterThan(0)
    }
  })

  it('keeps the nav label and the topbar title distinct where they differ', () => {
    // Home navigates as "Home" but the topbar reads "Studio".
    expect(VIEW_META.get('home')?.label).toBe('Home')
    expect(VIEW_META.get('home')?.title).toBe('Studio')
  })

  it('sources the timeline entry from the timeline scope', () => {
    expect(VIEW_META.get('timeline')?.label).toBe('Timeline')
    expect(VIEW_META.get('timeline')?.title).toBe('Timeline')
  })

  it('exposes the same table through getViewMeta', () => {
    expect(getViewMeta('library')).toEqual(VIEW_META.get('library'))
  })
})
