/**
 * Versioned hydration migrations for the Zustand store.
 *
 * Each migration function transforms persisted state from version N to N+1.
 * Migrations run sequentially in order. If any migration fails, the store
 * falls back to seed defaults.
 *
 * @see plans/ADRs/028-validated-recoverable-local-data-boundaries.md
 */

import type { Entity, Claim } from './types'

/** Shape of persisted state before migrations. */
interface PersistedStateV1 {
  version?: number
  entities: Entity[]
  claims: Claim[]
  chat?: unknown[]
  currentView?: string
  searchQuery?: string
  typeFilter?: string
  sortBy?: string
  sortDir?: string
  rightPanelOpen?: boolean
}

/** Signature for a single migration function. */
type MigrationFn = (state: PersistedStateV1) => PersistedStateV1

/**
 * Migration v1 → v2: Ensure all claims have version and editHistory fields.
 * Backfills createdAt/updatedAt on claims missing timestamps.
 */
const migration_1_to_2: MigrationFn = (state) => {
  const now = new Date().toISOString()
  const claims = state.claims.map((c) => ({
    ...c,
    createdAt: c.createdAt ?? now,
    updatedAt: c.updatedAt ?? now,
    version: c.version ?? 1,
    editHistory: c.editHistory ?? [],
  }))
  return { ...state, claims, version: 2 }
}

/**
 * Migration v2 → v3: Ensure all entities have createdAt/updatedAt timestamps.
 * Backfills with current time for entities missing them.
 */
const migration_2_to_3: MigrationFn = (state) => {
  const now = new Date().toISOString()
  const entities = state.entities.map((e) => ({
    ...e,
    createdAt: e.createdAt ?? now,
    updatedAt: e.updatedAt ?? now,
  }))
  return { ...state, entities, version: 3 }
}

/**
 * Migration v3 → v4: Ensure all entities have a tags array.
 * Backfills empty array for entities missing tags.
 */
const migration_3_to_4: MigrationFn = (state) => {
  const entities = state.entities.map((e) => ({
    ...e,
    tags: e.tags ?? [],
  }))
  return { ...state, entities, version: 4 }
}

/**
 * Migration v4 → v5: Ensure all entities have a links array.
 * Backfills empty array for entities missing links.
 */
const migration_4_to_5: MigrationFn = (state) => {
  const entities = state.entities.map((e) => ({
    ...e,
    links: e.links ?? [],
  }))
  return { ...state, entities, version: 5 }
}

/**
 * All migrations in order. Add new migrations at the end.
 * The array index + 1 corresponds to the migration version.
 */
const MIGRATIONS: MigrationFn[] = [
  migration_1_to_2,
  migration_2_to_3,
  migration_3_to_4,
  migration_4_to_5,
]

/**
 * Current schema version. Increment when adding migrations.
 */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length + 1

/**
 * Run all pending migrations on persisted state.
 *
 * @param persistedState - Raw state from localStorage
 * @param fromVersion - Envelope version supplied by the persist middleware.
 * When omitted, falls back to a version stamped inside the state (legacy
 * envelopes), then to 1. Zustand stores the version *outside* the state
 * object, so the explicit argument is the only trustworthy source.
 * @returns Migrated state at current schema version, or null if migration
 * failed or the payload is newer than this build supports (ADR 028 §4:
 * future-version data must be rejected, never re-persisted).
 */
export function runMigrations(persistedState: unknown, fromVersion?: number): PersistedStateV1 | null {
  try {
    if (!persistedState || typeof persistedState !== 'object') {
      return null
    }

    let state = persistedState as PersistedStateV1

    // Guard against empty or incomplete objects before running migrations
    if (!Array.isArray(state.entities) || !Array.isArray(state.claims)) {
      return null
    }

    const detectedVersion = fromVersion ?? state.version ?? 1

    if (!Number.isInteger(detectedVersion) || detectedVersion < 1) {
      console.warn(`Invalid persisted schema version: ${String(detectedVersion)}`)
      return null
    }

    // A newer build wrote this store — migrating "down" would silently strip
    // fields we cannot know about. Refuse and let hydration fall back safely.
    if (detectedVersion > CURRENT_SCHEMA_VERSION) {
      console.warn(
        `Persisted store version ${detectedVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}; refusing to migrate.`,
      )
      return null
    }

    let currentVersion = Math.max(1, detectedVersion)

    // Run each migration until reaching the current version
    while (currentVersion < CURRENT_SCHEMA_VERSION) {
      const migrationIndex = currentVersion - 1
      if (migrationIndex < 0 || migrationIndex >= MIGRATIONS.length) {
        console.warn(`No migration found for version ${currentVersion} → ${currentVersion + 1}`)
        return null
      }
      state = MIGRATIONS[migrationIndex](state)
      currentVersion += 1
    }

    return state
  } catch (err) {
    console.error('Migration failed:', err)
    return null
  }
}
