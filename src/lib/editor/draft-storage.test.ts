import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveDraft, loadDraft, removeDraft, generateDraftId, listDraftKeys, listAllDrafts } from './draft-storage'
import type { EditorDraft } from './draft-schema'

const VALID_DRAFT: EditorDraft = {
  id: 'test-draft-1',
  entityId: 'entity-1',
  name: 'Test Draft',
  content: '# Hello World',
  description: 'A test draft',
  type: 'note',
  sourceUrl: 'https://example.com',
  tags: ['test', 'draft'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
}

beforeEach(() => {
  localStorage.clear()
})

describe('generateDraftId', () => {
  it('returns a non-empty string', () => {
    const id = generateDraftId()
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('returns unique values on successive calls', () => {
    const firstId = generateDraftId()
    const secondId = generateDraftId()
    expect(firstId).not.toBe(secondId)
  })
})

describe('saveDraft', () => {
  it('persists a valid draft to localStorage', () => {
    saveDraft(VALID_DRAFT)
    const raw = localStorage.getItem('draft:test-draft-1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.name).toBe('Test Draft')
  })

  it('round-trips through loadDraft', () => {
    saveDraft(VALID_DRAFT)
    const loaded = loadDraft('test-draft-1')
    expect(loaded).toEqual(VALID_DRAFT)
  })

  it('throws on invalid draft data', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const invalid = { ...VALID_DRAFT, id: '' }
    expect(() => saveDraft(invalid as EditorDraft)).toThrow()
    spy.mockRestore()
  })
})

describe('loadDraft', () => {
  it('returns null for missing draft', () => {
    expect(loadDraft('nonexistent')).toBeNull()
  })

  it('returns null and removes corrupted data', () => {
    localStorage.setItem('draft:corrupt', '{"not":"valid"}')
    const result = loadDraft('corrupt')
    expect(result).toBeNull()
    expect(localStorage.getItem('draft:corrupt')).toBeNull()
  })

  it('returns null and removes invalid JSON', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorage.setItem('draft:bad-json', 'not json')
    const result = loadDraft('bad-json')
    expect(result).toBeNull()
    expect(localStorage.getItem('draft:bad-json')).toBeNull()
    spy.mockRestore()
  })
})

describe('removeDraft', () => {
  it('removes an existing draft', () => {
    saveDraft(VALID_DRAFT)
    removeDraft('test-draft-1')
    expect(loadDraft('test-draft-1')).toBeNull()
  })

  it('is a no-op for missing drafts', () => {
    expect(() => removeDraft('nonexistent')).not.toThrow()
  })
})

describe('listDraftKeys', () => {
  it('returns empty array when no drafts exist', () => {
    expect(listDraftKeys()).toEqual([])
  })

  it('lists all draft keys', () => {
    saveDraft(VALID_DRAFT)
    saveDraft({ ...VALID_DRAFT, id: 'test-draft-2' })
    const keys = listDraftKeys()
    expect(keys).toContain('test-draft-1')
    expect(keys).toContain('test-draft-2')
    expect(keys).toHaveLength(2)
  })

  it('ignores non-draft localStorage keys', () => {
    localStorage.setItem('other-key', 'value')
    saveDraft(VALID_DRAFT)
    const keys = listDraftKeys()
    expect(keys).toHaveLength(1)
    expect(keys[0]).toBe('test-draft-1')
  })
})

describe('listAllDrafts', () => {
  it('returns empty array when no drafts exist', () => {
    expect(listAllDrafts()).toEqual([])
  })

  it('returns all valid drafts', () => {
    const draft2 = { ...VALID_DRAFT, id: 'test-draft-2', name: 'Second' }
    saveDraft(VALID_DRAFT)
    saveDraft(draft2)
    const all = listAllDrafts()
    expect(all).toHaveLength(2)
    expect(all.map((d) => d.id).sort()).toEqual(['test-draft-1', 'test-draft-2'])
  })

  it('skips corrupted drafts', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveDraft(VALID_DRAFT)
    localStorage.setItem('draft:broken', 'not json')
    const all = listAllDrafts()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('test-draft-1')
    spy.mockRestore()
  })
})