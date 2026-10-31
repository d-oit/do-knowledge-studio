/**
 * Backup archive constants, types, and structural schemas (Issue #1040).
 */
import { z } from 'zod'
import type { Entity, Claim } from '@/lib/studio/types'
import type {
  ValidatedGraph,
  ValidatedLink,
  ValidatedMindMap,
  ValidatedTag,
} from '@/lib/studio/schema'

/** Marker stored in every backup archive. */
export const BACKUP_FORMAT = 'do-knowledge-studio-backup' as const
/** Current archive format version. */
export const BACKUP_FORMAT_VERSION = 1
/** Oldest payload schema this build can restore without guessing. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1
/** PBKDF2-HMAC-SHA256 iterations for passphrase encryption. */
export const BACKUP_KDF_ITERATIONS = 310_000
/** PBKDF2 salt length in bytes. */
export const KDF_SALT_BYTES = 16
/** AES-GCM IV length in bytes. */
export const AES_IV_BYTES = 12
/** AES-GCM tag length in bits. */
export const AES_TAG_BITS = 128

/** Payload file paths inside the archive. */
export const BACKUP_FILE_PATHS = {
  entities: 'data/entities.json',
  claims: 'data/claims.json',
  canvas: 'data/canvas.json',
} as const

export interface BackupEncryptionHeader {
  algorithm: 'AES-256-GCM'
  kdf: 'PBKDF2-HMAC-SHA256'
  iterations: number
  salt: string
  iv: string
  ciphertextSha256: string
}

export interface BackupFileEntry {
  path: string
  bytes: number
  sha256: string
}

export interface BackupRecordCounts {
  entities: number
  claims: number
  graphNodes: number
  graphEdges: number
  mindMapNodes: number
  mindMapEdges: number
  links: number
  tags: number
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  counts: BackupRecordCounts
  files: BackupFileEntry[]
}

/** Decoded, verified archive content. */
export interface BackupArchiveContent {
  manifest: BackupManifest
  files: Record<string, string>
}

/** Structured failure codes the UI can translate without parsing messages. */
export type BackupErrorCode =
  | 'unreadable'
  | 'format'
  | 'format-version'
  | 'schema-version'
  | 'passphrase-required'
  | 'decrypt-failed'
  | 'checksum'
  | 'manifest'
  | 'payload'
  | 'counts'
  | 'references'

export interface BackupFailure {
  ok: false
  code: BackupErrorCode
  errors: string[]
}

/** Canvas records carried alongside the corpus. */
export interface BackupCanvas {
  graph?: ValidatedGraph | null
  mindMap?: ValidatedMindMap | null
  links?: ValidatedLink[] | null
  tags?: ValidatedTag[] | null
}

/** Inputs accepted by the archive builder. */
export interface BackupSource extends BackupCanvas {
  entities: Entity[]
  claims: Claim[]
  appVersion: string
}

/** Verified payload before restore preview. */
export interface VerifiedBackup extends BackupCanvas {
  manifest: BackupManifest
  entities: Entity[]
  claims: Claim[]
}

/** Validation of the archive encryption header before decryption. */
export const EncryptionHeaderSchema = z.object({
  algorithm: z.literal('AES-256-GCM'),
  kdf: z.literal('PBKDF2-HMAC-SHA256'),
  iterations: z.number().int().min(100_000).max(10_000_000),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertextSha256: z.string().regex(/^[0-9a-f]{64}$/),
})

const FileEntrySchema = z.object({
  path: z.string().min(1),
  bytes: z.number().int().min(0),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
})

export const ManifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string().min(1),
  exportedAt: z.string().min(1),
  counts: z.object({
    entities: z.number().int().min(0),
    claims: z.number().int().min(0),
    graphNodes: z.number().int().min(0),
    graphEdges: z.number().int().min(0),
    mindMapNodes: z.number().int().min(0),
    mindMapEdges: z.number().int().min(0),
    links: z.number().int().min(0),
    tags: z.number().int().min(0),
  }),
  files: z.array(FileEntrySchema).min(1),
})

export const EnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.number().int().positive(),
  encryption: EncryptionHeaderSchema.nullable(),
  manifest: ManifestSchema.nullable(),
  files: z.record(z.string(), z.string()).nullable(),
  ciphertext: z.string().nullable(),
})

/** JSON value with a nullable payload, matching the archive envelope. */
export type BackupEnvelope = z.infer<typeof EnvelopeSchema>
