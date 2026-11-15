/**
 * Attachments: metadata model, hashing, and quota guards (#1135).
 *
 * Blobs live in a dedicated IndexedDB object store (`attachments`, keyed by
 * sha-256 hex); entities carry only the metadata below. Everything crossing
 * the boundary is Zod-validated; oversize/over-quota writes are rejected
 * before any byte is stored.
 */
import { z } from 'zod'

/** Max bytes per attachment (25 MiB). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

/** Soft quota for the whole attachment store (500 MiB). */
export const ATTACHMENT_QUOTA_BYTES = 500 * 1024 * 1024

/** Max attachments referenceable from one entity. */
export const MAX_ATTACHMENTS_PER_ENTITY = 50

/** IndexedDB database / store names for attachment blobs. */
export const ATTACHMENT_DB_NAME = 'dks-attachments'
export const ATTACHMENT_STORE_NAME = 'blobs'

/** Zod schema for attachment metadata stored on the entity. */
export const AttachmentSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().min(1),
})

/** Attachment metadata (blob itself lives in IndexedDB). */
export type Attachment = z.infer<typeof AttachmentSchema>

/** Result of a quota pre-check. */
export interface QuotaCheck {
  ok: boolean
  reason?: 'too-large' | 'quota-exceeded' | 'too-many'
}

/** Pure pre-check: size, store quota, and per-entity count. */
export const checkAttachmentQuota = (
  sizeBytes: number,
  usedBytes: number,
  entityCount: number,
): QuotaCheck => {
  if (sizeBytes > MAX_ATTACHMENT_BYTES) return { ok: false, reason: 'too-large' }
  if (usedBytes + sizeBytes > ATTACHMENT_QUOTA_BYTES) return { ok: false, reason: 'quota-exceeded' }
  if (entityCount >= MAX_ATTACHMENTS_PER_ENTITY) return { ok: false, reason: 'too-many' }
  return { ok: true }
}

/** Computes the SHA-256 hex digest of bytes (WebCrypto, no main-thread copy). */
export const sha256Hex = async (data: Blob | ArrayBuffer | Uint8Array): Promise<string> => {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data
  const digest = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Builds validated attachment metadata for a new upload. */
export const createAttachmentMeta = (input: {
  entityId: string
  name: string
  mimeType: string
  sizeBytes: number
  sha256: string
}): Attachment =>
  AttachmentSchema.parse({ ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
