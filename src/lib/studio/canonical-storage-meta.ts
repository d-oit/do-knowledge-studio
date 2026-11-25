/**
 * Small, non-canonical boot metadata for the canonical store (ADR 046).
 *
 * The metadata envelope carries counts, a schema version and a timestamp — never
 * entity text. That is what makes it acceptable to keep it in localStorage while
 * the canonical corpus itself is encrypted (ADR 048 §5): it reveals how many
 * records exist, which the settings view already reports, and nothing readable.
 */
import type { StorageValue } from 'zustand/middleware'
import { CURRENT_SCHEMA_VERSION } from './migrations'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for canonical-storage logs. */
const log = logger.child({ area: 'store' })

/** localStorage key for the small, non-canonical metadata envelope. */
export const CANONICAL_META_KEY = 'do-knowledge-studio-store-meta'
/** Version of the metadata envelope shape. */
export const CANONICAL_META_FORMAT_VERSION = 1

/** Small, non-canonical boot metadata written to localStorage. */
export interface CanonicalMetadata {
  formatVersion: number
  schemaVersion: number
  updatedAt: string
  entityCount: number
  claimCount: number
  storage: 'indexeddb'
}

/** Safe localStorage accessor; returns null when the browser blocks it. */
export const getSafeLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch (error) {
    log.warn('Browser localStorage is unavailable', { error })
    return null
  }
}

/** Build the small metadata envelope from a full persisted value. */
const buildMetadata = (value: StorageValue<unknown>): CanonicalMetadata => {
  const state = typeof value.state === 'object' && value.state !== null ? value.state : {}
  const entities = 'entities' in state && Array.isArray(state.entities) ? state.entities : []
  const claims = 'claims' in state && Array.isArray(state.claims) ? state.claims : []
  return {
    formatVersion: CANONICAL_META_FORMAT_VERSION,
    schemaVersion: typeof value.version === 'number' ? value.version : CURRENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    entityCount: entities.length,
    claimCount: claims.length,
    storage: 'indexeddb',
  }
}

/** Write the metadata envelope; metadata failure never fails the corpus write. */
export const writeMetadata = (value: StorageValue<unknown>): void => {
  const storage = getSafeLocalStorage()
  if (storage === null) return
  try {
    storage.setItem(CANONICAL_META_KEY, JSON.stringify(buildMetadata(value)))
  } catch (error) {
    log.warn('Failed to write the studio storage metadata envelope', { error })
  }
}

/** Read the metadata envelope defensively; used only to detect a prior IDB store. */
export const readMetadata = (): CanonicalMetadata | null => {
  const storage = getSafeLocalStorage()
  if (storage === null) return null
  try {
    const raw = storage.getItem(CANONICAL_META_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as CanonicalMetadata
  } catch (error) {
    log.warn('Ignored unreadable studio storage metadata', { error })
    return null
  }
}
