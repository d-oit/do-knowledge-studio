import { z } from 'zod'
import type { Entity, Claim } from '@/lib/studio/types'
import { validateInboundEntities, validateInboundClaims } from './inbound'
import { mergeEntities, mergeClaims, type FieldConflict } from './merge'
import { encryptRoomPayload, decryptRoomPayload } from './security'

/** Marker that identifies a sync bundle file. */
export const SYNC_BUNDLE_FORMAT = 'dks-sync-bundle'
/** Bundle schema version. Bump only with a migration path. */
export const SYNC_BUNDLE_VERSION = 1
/** File extension for a sync bundle. */
export const SYNC_BUNDLE_EXTENSION = '.dksb'
/** Upper bound on a bundle file, checked before parsing. */
export const MAX_SYNC_BUNDLE_BYTES = 32 * 1024 * 1024

const bundleHeader = {
  format: z.literal(SYNC_BUNDLE_FORMAT),
  version: z.literal(SYNC_BUNDLE_VERSION),
  roomId: z.string().min(1),
  createdAt: z.string().min(1),
}

const PlainBundleSchema = z.object({
  ...bundleHeader,
  encrypted: z.literal(false),
  entities: z.array(z.unknown()),
  claims: z.array(z.unknown()),
})

const EncryptedBundleSchema = z.object({
  ...bundleHeader,
  encrypted: z.literal(true),
  envelope: z.unknown(),
})

const SyncBundleSchema = z.discriminatedUnion('encrypted', [
  PlainBundleSchema,
  EncryptedBundleSchema,
])

/** A validated, decrypted bundle ready to merge. */
export interface SyncBundle {
  roomId: string
  createdAt: string
  entities: Entity[]
  claims: Claim[]
}

/** Why a bundle could not be read. Each code maps to one user-facing message. */
export type SyncBundleErrorCode =
  | 'too-large'
  | 'invalid-json'
  | 'unsupported-format'
  | 'unsupported-version'
  | 'password-required'
  | 'decrypt-failed'
  | 'invalid-records'

export type SyncBundleParseResult =
  | { ok: true; bundle: SyncBundle }
  | { ok: false; code: SyncBundleErrorCode; detail?: string }

/** Result of merging a bundle into the local corpus. */
export interface SyncBundleMergeResult {
  entities: Entity[]
  claims: Claim[]
  conflicts: FieldConflict[]
}

/** Options for building a bundle. A password encrypts the record payload. */
export interface BuildSyncBundleOptions {
  roomId: string
  entities: Entity[]
  claims: Claim[]
  password?: string
  now?: Date
}

/**
 * Serialize the local corpus into a portable sync bundle.
 *
 * The header (format, version, room id, timestamp) stays readable so a user can
 * tell which room a file belongs to; only the records are encrypted. The room id
 * is bound into the AES-GCM additional data, so a tampered header fails to
 * decrypt rather than merging into the wrong room.
 */
export const buildSyncBundle = async ({
  roomId,
  entities,
  claims,
  password,
  now = new Date(),
}: BuildSyncBundleOptions): Promise<string> => {
  const header = {
    format: SYNC_BUNDLE_FORMAT,
    version: SYNC_BUNDLE_VERSION,
    roomId,
    createdAt: now.toISOString(),
  }
  if (password === undefined || password === '') {
    return JSON.stringify({ ...header, encrypted: false, entities, claims })
  }
  const envelope = await encryptRoomPayload(
    roomId,
    password,
    JSON.stringify({ entities, claims }),
  )
  return JSON.stringify({ ...header, encrypted: true, envelope })
}

/** True when a file name looks like a sync bundle. */
export const isSyncBundleFileName = (name: string): boolean =>
  name.toLowerCase().endsWith(SYNC_BUNDLE_EXTENSION)

/** Deterministic, filesystem-safe bundle name. */
export const syncBundleFileName = (roomId: string, now: Date = new Date()): string => {
  const safeRoom = roomId.replace(/[^A-Za-z0-9_-]+/g, '-')
  return `dks-sync-${safeRoom}-${now.toISOString().slice(0, 10)}${SYNC_BUNDLE_EXTENSION}`
}

const validateRecords = (
  entities: unknown[],
  claims: unknown[],
): SyncBundleParseResult => {
  const entityResult = validateInboundEntities(entities)
  const claimResult = validateInboundClaims(claims)
  if (entityResult.rejected.length > 0 || claimResult.rejected.length > 0) {
    const first = entityResult.rejected[0] ?? claimResult.rejected[0]
    const detail = first?.errors.map((error) => `${error.path}: ${error.message}`).join('; ')
    return { ok: false, code: 'invalid-records', detail }
  }
  return {
    ok: true,
    bundle: {
      roomId: '',
      createdAt: '',
      entities: entityResult.valid,
      claims: claimResult.valid,
    },
  }
}

/**
 * Parse and validate a bundle file.
 *
 * Rejects oversized input before parsing, unknown formats and versions, a
 * missing password for an encrypted bundle, and any record that fails the
 * entity/claim schema. Never throws for bad input.
 */
export const parseSyncBundle = async (
  text: string,
  password?: string,
): Promise<SyncBundleParseResult> => {
  if (text.length > MAX_SYNC_BUNDLE_BYTES) return { ok: false, code: 'too-large' }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, code: 'invalid-json' }
  }

  const header = SyncBundleSchema.safeParse(raw)
  if (!header.success) {
    const candidate = raw as { format?: unknown; version?: unknown } | null
    if (candidate?.format !== SYNC_BUNDLE_FORMAT) {
      return { ok: false, code: 'unsupported-format' }
    }
    if (candidate.version !== SYNC_BUNDLE_VERSION) {
      return { ok: false, code: 'unsupported-version' }
    }
    return { ok: false, code: 'invalid-json' }
  }

  const parsed = header.data
  if (!parsed.encrypted) {
    const records = validateRecords(parsed.entities, parsed.claims)
    if (!records.ok) return records
    return {
      ok: true,
      bundle: { ...records.bundle, roomId: parsed.roomId, createdAt: parsed.createdAt },
    }
  }

  if (password === undefined || password === '') {
    return { ok: false, code: 'password-required' }
  }

  let decrypted: string
  try {
    decrypted = await decryptRoomPayload(parsed.roomId, password, parsed.envelope)
  } catch {
    // Wrong password, tampered header, or corrupted ciphertext all land here.
    return { ok: false, code: 'decrypt-failed' }
  }

  let payload: unknown
  try {
    payload = JSON.parse(decrypted)
  } catch {
    return { ok: false, code: 'invalid-json' }
  }
  const records = payload as { entities?: unknown; claims?: unknown }
  if (!Array.isArray(records.entities) || !Array.isArray(records.claims)) {
    return { ok: false, code: 'invalid-json' }
  }
  const validated = validateRecords(records.entities, records.claims)
  if (!validated.ok) return validated
  return {
    ok: true,
    bundle: { ...validated.bundle, roomId: parsed.roomId, createdAt: parsed.createdAt },
  }
}

/**
 * Merge a bundle into the local corpus.
 *
 * Pure: the caller commits the result. Merging the same bundle twice is a
 * no-op because records are matched by id and resolved by timestamp.
 */
export const mergeSyncBundle = (
  bundle: Pick<SyncBundle, 'entities' | 'claims'>,
  localEntities: Entity[],
  localClaims: Claim[],
): SyncBundleMergeResult => {
  const entityResult = mergeEntities(localEntities, bundle.entities)
  const claimResult = mergeClaims(localClaims, bundle.claims)
  return {
    entities: entityResult.merged,
    claims: claimResult.merged,
    conflicts: [...entityResult.conflicts, ...claimResult.conflicts],
  }
}
