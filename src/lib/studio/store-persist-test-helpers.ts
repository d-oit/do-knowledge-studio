import { vi } from 'vitest'
import { STUDIO_STORAGE_KEY } from './hydration'

/**
 * Each test rebuilds the store module against the shared localStorage mock
 * so the full pipeline — partialize → serialize → read → migrate → Zod
 * validate → merge — executes exactly as it does on a page reload. Values
 * are stored in the middleware's real envelope format ({ state, version }).
 */
export const freshStore = async () => {
  vi.resetModules()
  return import('./store')
}

export const writeEnvelope = (state: Record<string, unknown>, version: number): string => {
  const raw = JSON.stringify({ state, version })
  localStorage.setItem(STUDIO_STORAGE_KEY, raw)
  return raw
}

/** Explicitly pre-v1 envelope version, rejected rather than guessed forward. */
export const VERSION_BEFORE_V1 = 0

export const USER_ENTITY = {
  id: 'persist-test-user-entity',
  name: 'User Corpus Marker',
  type: 'note' as const,
  description: 'Created by the user before reload.',
  content: 'User content',
  tags: ['important'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

export const validEnvelope = (overrides: Record<string, unknown> = {}) => ({
  entities: [USER_ENTITY],
  claims: [],
  chat: [],
  currentView: 'library',
  typeFilter: 'all',
  sortBy: 'updated',
  sortDir: 'desc',
  rightPanelOpen: true,
  ...overrides,
})
