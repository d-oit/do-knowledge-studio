/**
 * Backup archive verification (mirrors the studio's `src/lib/backup/
 * archive.ts` flow): a `.dksb` archive is a single UTF-8 JSON envelope
 * whose format/version, optional PBKDF2/AES-256-GCM ciphertext hash, payload
 * inventory, per-file SHA-256 checksums, record counts, and references are
 * all verified before anything is reported as valid. This core service is
 * dependency-free and uses the standard WebCrypto API available in both
 * browsers and Node 22+.
 */

/** Marker stored in every backup archive. */
export const BACKUP_FORMAT = 'do-knowledge-studio-backup' as const
/** Current archive format version. */
export const BACKUP_FORMAT_VERSION = 1
/** Oldest payload schema this build can verify without guessing. */
export const MIN_SUPPORTED_SCHEMA_VERSION = 1
/** PBKDF2-HMAC-SHA256 iterations for passphrase encryption. */
export const BACKUP_KDF_ITERATIONS = 310_000

/** Payload file paths inside the archive. */
export const BACKUP_FILE_PATHS = {
  entities: 'data/entities.json',
  claims: 'data/claims.json',
  canvas: 'data/canvas.json',
} as const

/** Structured failure codes (identical names to the studio UI labels). */
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

/** A backup verification failure. */
export interface BackupFailure {
  ok: false
  code: BackupErrorCode
  errors: string[]
}

/** Verified archive summary (payload bodies are not returned). */
export interface VerifiedBackupSummary {
  ok: true
  formatVersion: number
  schemaVersion: number
  appVersion: string
  exportedAt: string
  encrypted: boolean
  entityCount: number
  claimCount: number
  graphEdgeCount: number
  mindMapEdgeCount: number
  linkCount: number
  tagCount: number
  graphViewCount: number
}

/** Result of verification: either a summary or a structured failure. */
export type BackupVerifyResult = VerifiedBackupSummary | BackupFailure

/** Computes the hex SHA-256 of bytes. */
const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Decodes base64 into bytes; throws on malformed input. */
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i)
  return out
}

/** Parses JSON; returns undefined on any parse failure. */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const failure = (code: BackupErrorCode, errors: string[]): BackupFailure => ({ ok: false, code, errors })

/** Structural checks on the manifest object (no third-party schema lib). */
const validateManifest = (value: unknown): BackupFailure | { ok: true; manifest: Record<string, unknown> } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failure('format', ['backup manifest is not an object'])
  }
  const m = value as Record<string, unknown>
  if (m.format !== BACKUP_FORMAT) return failure('format', ['backup manifest format marker is missing'])
  if (typeof m.formatVersion !== 'number' || !Number.isInteger(m.formatVersion) || m.formatVersion <= 0) {
    return failure('format', ['backup format version is invalid'])
  }
  if (typeof m.schemaVersion !== 'number' || !Number.isInteger(m.schemaVersion) || m.schemaVersion <= 0) {
    return failure('format', ['backup schema version is invalid'])
  }
  if (typeof m.appVersion !== 'string' || m.appVersion === '') {
    return failure('format', ['backup app version is invalid'])
  }
  if (typeof m.exportedAt !== 'string' || m.exportedAt === '') {
    return failure('format', ['backup exportedAt is invalid'])
  }
  if (typeof m.counts !== 'object' || m.counts === null || Array.isArray(m.counts)) {
    return failure('format', ['backup counts are invalid'])
  }
  const counts = m.counts as Record<string, unknown>
  for (const key of ['entities', 'claims', 'graphNodes', 'graphEdges', 'mindMapNodes', 'mindMapEdges', 'links', 'tags']) {
    const v = counts[key]
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      return failure('format', [`backup count "${key}" is invalid`])
    }
  }
  if (!Array.isArray(m.files) || m.files.length === 0) {
    return failure('format', ['backup manifest file inventory is missing'])
  }
  const hex64 = /^[0-9a-f]{64}$/
  for (const f of m.files) {
    if (typeof f !== 'object' || f === null) return failure('format', ['backup file entry is invalid'])
    const fe = f as Record<string, unknown>
    if (
      typeof fe.path !== 'string' || fe.path === '' ||
      typeof fe.bytes !== 'number' || !Number.isInteger(fe.bytes) || fe.bytes < 0 ||
      typeof fe.sha256 !== 'string' || !hex64.test(fe.sha256)
    ) {
      return failure('format', ['backup file entry is invalid'])
    }
  }
  return { ok: true, manifest: m }
}

/** Validates the encryption header when present. */
const validateEncryptionHeader = (value: unknown): BackupFailure | { ok: true; header: Record<string, unknown> } => {
  if (value === null) return { ok: true, header: {} }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return failure('format', ['backup encryption header is invalid'])
  }
  const h = value as Record<string, unknown>
  if (h.algorithm !== 'AES-256-GCM' || h.kdf !== 'PBKDF2-HMAC-SHA256') {
    return failure('format', ['backup encryption algorithm is unsupported'])
  }
  if (typeof h.iterations !== 'number' || !Number.isInteger(h.iterations) || h.iterations < 100_000 || h.iterations > 10_000_000) {
    return failure('format', ['backup KDF iterations are out of range'])
  }
  if (typeof h.salt !== 'string' || h.salt === '' || typeof h.iv !== 'string' || h.iv === '') {
    return failure('format', ['backup encryption salt/iv are invalid'])
  }
  if (typeof h.ciphertextSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(h.ciphertextSha256)) {
    return failure('format', ['backup ciphertext hash is invalid'])
  }
  return { ok: true, header: h }
}

/** Decrypts the archive payload; mirrors the studio crypto parameters. */
const decryptArchivePayload = async (
  ciphertext: Uint8Array<ArrayBuffer>,
  header: Record<string, unknown>,
  passphrase: string,
): Promise<string> => {
  const subtle = globalThis.crypto.subtle
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(String(header.salt)),
      iterations: Number(header.iterations),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(String(header.iv)), tagLength: 128 },
    key,
    ciphertext,
  )
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
}

/** Verifies manifest-declared hashes against the payload files. */
const verifyFileHashes = async (
  manifest: Record<string, unknown>,
  files: Record<string, string>,
): Promise<BackupFailure | { ok: true }> => {
  const entries = manifest.files as Array<Record<string, unknown>>
  for (const entry of entries) {
    const path = String(entry.path)
    const content = files[path]
    if (content === undefined) return failure('checksum', [`missing payload file: ${path}`])
    const bytes = new TextEncoder().encode(content)
    if (bytes.length !== Number(entry.bytes)) {
      return failure('checksum', [`payload size mismatch: ${path}`])
    }
    if ((await sha256Hex(bytes)) !== String(entry.sha256)) {
      return failure('checksum', [`payload checksum mismatch: ${path}`])
    }
  }
  return { ok: true }
}

/** Verifies record counts and references against parsed payload files. */
const validatePayload = (
  files: Record<string, string>,
  manifest: Record<string, unknown>,
): BackupFailure | { ok: true; entityCount: number; claimCount: number; graphEdgeCount: number; mindMapEdgeCount: number; linkCount: number; tagCount: number; graphViewCount: number } => {
  const expected = new Set(Object.values(BACKUP_FILE_PATHS))
  const actual = new Set(Object.keys(files))
  if (actual.size !== expected.size || [...expected].some((p) => !actual.has(p))) {
    return failure('manifest', ['backup payload file inventory is incomplete or unexpected'])
  }
  const entitiesFile = parseJson(files[BACKUP_FILE_PATHS.entities] ?? '') as { entities?: unknown } | undefined
  const claimsFile = parseJson(files[BACKUP_FILE_PATHS.claims] ?? '') as { claims?: unknown } | undefined
  const canvasFile = parseJson(files[BACKUP_FILE_PATHS.canvas] ?? '') as Record<string, unknown> | undefined
  if (entitiesFile === undefined || claimsFile === undefined || canvasFile === undefined) {
    return failure('payload', ['payload file is not valid JSON'])
  }
  const entities = entitiesFile.entities
  const claims = claimsFile.claims
  if (!Array.isArray(entities) || !Array.isArray(claims)) {
    return failure('payload', ['entities/claims payload arrays are invalid'])
  }
  const entityIds = new Set<string>()
  for (const entity of entities) {
    const id = (entity as Record<string, unknown> | null)?.id
    if (typeof id !== 'string' || id === '') return failure('payload', ['entity record is missing an id'])
    if (entityIds.has(id)) return failure('references', [`duplicate entity id: ${id}`])
    entityIds.add(id)
  }
  const claimIds = new Set<string>()
  for (const claim of claims) {
    const record = claim as Record<string, unknown> | null
    const id = record?.id
    const entityId = record?.entityId
    if (typeof id !== 'string' || typeof entityId !== 'string') {
      return failure('payload', ['claim record is missing an id or entityId'])
    }
    if (claimIds.has(id) || entityIds.has(id)) {
      return failure('references', [`duplicate record id: ${id}`])
    }
    claimIds.add(id)
    if (!entityIds.has(entityId)) {
      return failure('references', [`claim ${id} references a missing entity: ${entityId}`])
    }
  }

  const checkEdges = (value: unknown, label: string): BackupFailure | { ok: true; count: number } => {
    if (value === undefined || value === null) return { ok: true, count: 0 }
    if (!Array.isArray(value)) return failure('references', [`${label} is not an array`])
    for (const edge of value) {
      const rec = edge as Record<string, unknown> | null
      const source = rec?.source ?? rec?.sourceId
      const target = rec?.target ?? rec?.targetId
      if ((typeof source !== 'string' || !entityIds.has(source)) || (typeof target !== 'string' || !entityIds.has(target))) {
        return failure('references', [`${label} edge references a missing entity`])
      }
    }
    return { ok: true, count: value.length }
  }

  const graph = canvasFile.graph
  const mindMap = canvasFile.mindMap
  const links = canvasFile.links
  const tags = canvasFile.tags ?? []
  const graphViews = canvasFile.graphViews ?? []
  const graphEdges = typeof graph === 'object' && graph !== null ? (graph as Record<string, unknown>).edges : graph
  const mindMapEdges = typeof mindMap === 'object' && mindMap !== null ? (mindMap as Record<string, unknown>).edges : mindMap
  const g = checkEdges(graphEdges, 'graph')
  if (!g.ok) return g
  const m = checkEdges(mindMapEdges, 'mindMap')
  if (!m.ok) return m
  const l = checkEdges(links, 'links')
  if (!l.ok) return l
  if (!Array.isArray(tags) || !Array.isArray(graphViews)) {
    return failure('payload', ['canvas tags/graphViews are not arrays'])
  }

  const manifestCounts = (manifest.counts as Record<string, unknown>)
  const counts = {
    entities: entities.length,
    claims: claims.length,
    graphNodes: typeof graph === 'object' && graph !== null ? ((graph as Record<string, unknown>).nodes as unknown[] | undefined)?.length ?? 0 : 0,
    graphEdges: g.count,
    mindMapNodes: typeof mindMap === 'object' && mindMap !== null ? ((mindMap as Record<string, unknown>).nodes as unknown[] | undefined)?.length ?? 0 : 0,
    mindMapEdges: m.count,
    links: l.count,
    tags: tags.length,
  }
  if (JSON.stringify(counts) !== JSON.stringify(manifestCounts)) {
    return failure('counts', ['manifest record counts do not match the payload'])
  }
  return { ok: true,
    entityCount: entities.length,
    claimCount: claims.length,
    graphEdgeCount: g.count,
    mindMapEdgeCount: m.count,
    linkCount: l.count,
    tagCount: tags.length,
    graphViewCount: graphViews.length,
  }
}

/**
 * Verifies a backup archive. Corrupt, truncated, tampered, future-version,
 * and wrong-passphrase archives all fail before anything is reported valid.
 * @param raw - Archive text (UTF-8 JSON).
 * @param passphrase - Passphrase for encrypted archives (optional).
 * @returns A verified summary, or a structured failure.
 */
export const verifyBackupArchive = async (raw: string, passphrase?: string): Promise<BackupVerifyResult> => {
  const envelopeValue = parseJson(raw)
  if (envelopeValue === undefined) return failure('unreadable', ['backup file is not valid JSON'])
  if (typeof envelopeValue !== 'object' || envelopeValue === null || Array.isArray(envelopeValue)) {
    return failure('format', ['backup envelope is not an object'])
  }
  const envelope = envelopeValue as Record<string, unknown>
  if (envelope.format !== BACKUP_FORMAT) {
    return failure('format', ['not a do-knowledge-studio backup archive'])
  }
  if (typeof envelope.formatVersion !== 'number' || !Number.isInteger(envelope.formatVersion) || envelope.formatVersion <= 0) {
    return failure('format', ['backup format version is invalid'])
  }
  if (envelope.formatVersion > BACKUP_FORMAT_VERSION) {
    return failure('format-version', [
      `unsupported backup format version ${envelope.formatVersion}; this build supports ${BACKUP_FORMAT_VERSION}`,
    ])
  }

  const headerCheck = validateEncryptionHeader(envelope.encryption)
  if (!headerCheck.ok) return headerCheck
  const encrypted = envelope.encryption !== null

  let manifest: Record<string, unknown>
  let files: Record<string, string>
  if (encrypted) {
    if (typeof envelope.ciphertext !== 'string' || envelope.ciphertext === '') {
      return failure('format', ['encrypted backup is missing its ciphertext'])
    }
    if (!passphrase) {
      return failure('passphrase-required', ['this backup is encrypted; pass a passphrase to verify it'])
    }
    let ciphertext: Uint8Array<ArrayBuffer>
    try {
      ciphertext = fromBase64(envelope.ciphertext)
    } catch {
      return failure('unreadable', ['backup ciphertext is not valid base64'])
    }
    if ((await sha256Hex(ciphertext)) !== String(headerCheck.header.ciphertextSha256)) {
      return failure('checksum', ['backup ciphertext checksum mismatch'])
    }
    let plaintext: string
    try {
      plaintext = await decryptArchivePayload(ciphertext, headerCheck.header, passphrase)
    } catch {
      return failure('decrypt-failed', [
        'backup could not be decrypted; the passphrase is wrong or the archive was tampered with',
      ])
    }
    const inner = parseJson(plaintext) as { manifest?: unknown; files?: unknown } | undefined
    if (inner === undefined || inner.manifest === undefined || inner.files === undefined) {
      return failure('format', ['decrypted backup payload is malformed'])
    }
    if (typeof inner.files !== 'object' || inner.files === null || Array.isArray(inner.files)) {
      return failure('payload', ['decrypted payload files are malformed'])
    }
    const innerManifest = validateManifest(inner.manifest)
    if (!innerManifest.ok) return innerManifest
    manifest = innerManifest.manifest
    files = inner.files as Record<string, string>
  } else {
    if (envelope.manifest === undefined || envelope.files === undefined) {
      return failure('format', ['unencrypted backup is missing its manifest or files'])
    }
    if (typeof envelope.files !== 'object' || envelope.files === null || Array.isArray(envelope.files)) {
      return failure('payload', ['payload files are malformed'])
    }
    const manifestCheck = validateManifest(envelope.manifest)
    if (!manifestCheck.ok) return manifestCheck
    manifest = manifestCheck.manifest
    files = envelope.files as Record<string, string>
  }

  if (Number(manifest.schemaVersion) > Number.MAX_SAFE_INTEGER || Number(manifest.schemaVersion) < MIN_SUPPORTED_SCHEMA_VERSION) {
    return failure('schema-version', [
      `backup schema version ${manifest.schemaVersion} is not supported by this build`,
    ])
  }

  const hashes = await verifyFileHashes(manifest, files)
  if (!hashes.ok) return hashes
  const payload = validatePayload(files, manifest)
  if (!payload.ok) return payload

  return {
    ok: true,
    formatVersion: Number(manifest.formatVersion),
    schemaVersion: Number(manifest.schemaVersion),
    appVersion: String(manifest.appVersion),
    exportedAt: String(manifest.exportedAt),
    encrypted,
    entityCount: payload.entityCount,
    claimCount: payload.claimCount,
    graphEdgeCount: payload.graphEdgeCount,
    mindMapEdgeCount: payload.mindMapEdgeCount,
    linkCount: payload.linkCount,
    tagCount: payload.tagCount,
    graphViewCount: payload.graphViewCount,
  }
}
