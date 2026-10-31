/**
 * Portable, verifiable backup archive (Issue #1040).
 *
 * The archive is a single UTF-8 JSON document so it can be copied, hashed,
 * emailed, or stored anywhere without a ZIP reader. Every payload file carries
 * a SHA-256 digest in the manifest; optional passphrase encryption wraps the
 * complete manifest + file map in PBKDF2-derived AES-256-GCM. Nothing is parsed
 * or passed to the store until the archive's format, versions, ciphertext hash,
 * payload hashes, and Zod schemas all pass.
 */
import { CURRENT_SCHEMA_VERSION } from '@/lib/studio/migrations'
import {
  ExportPayloadSchema,
  validateImportPayload,
  type ValidationError,
} from '@/lib/studio/schema'
import {
  BACKUP_FILE_PATHS,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  EnvelopeSchema,
  ManifestSchema,
  MIN_SUPPORTED_SCHEMA_VERSION,
  type BackupCanvas,
  type BackupEnvelope,
  type BackupErrorCode,
  type BackupFailure,
  type BackupFileEntry,
  type BackupManifest,
  type BackupRecordCounts,
  type BackupSource,
  type VerifiedBackup,
} from './archive-format'
import {
  decryptArchivePayload,
  encryptArchivePayload,
  fromBase64,
  sha256Hex,
  sha256Text,
} from './archive-crypto'

export * from './archive-format'
export type { BackupCanvas, BackupSource, VerifiedBackup }

const failure = (code: BackupErrorCode, errors: string[]): BackupFailure => ({ ok: false, code, errors })

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Counts recorded in the manifest. */
const countRecords = (source: BackupSource): BackupRecordCounts => ({
  entities: source.entities.length,
  claims: source.claims.length,
  graphNodes: source.graph?.nodes.length ?? 0,
  graphEdges: source.graph?.edges.length ?? 0,
  mindMapNodes: source.mindMap?.nodes.length ?? 0,
  mindMapEdges: source.mindMap?.edges.length ?? 0,
  links: source.links?.length ?? 0,
  tags: source.tags?.length ?? 0,
})

const buildPayloadFiles = (source: BackupSource): Record<string, string> => ({
  [BACKUP_FILE_PATHS.entities]: JSON.stringify({ entities: source.entities }),
  [BACKUP_FILE_PATHS.claims]: JSON.stringify({ claims: source.claims }),
  [BACKUP_FILE_PATHS.canvas]: JSON.stringify({
    graph: source.graph ?? null,
    mindMap: source.mindMap ?? null,
    links: source.links ?? null,
    tags: source.tags ?? null,
  }),
})

const buildManifestAndFiles = async (
  source: BackupSource,
): Promise<{ manifest: BackupManifest; files: Record<string, string> }> => {
  const files = buildPayloadFiles(source)
  const inventory: BackupFileEntry[] = await Promise.all(
    Object.entries(files).map(async ([path, content]) => ({
      path,
      bytes: new TextEncoder().encode(content).length,
      sha256: await sha256Text(content),
    })),
  )
  return {
    manifest: {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      appVersion: source.appVersion,
      exportedAt: new Date().toISOString(),
      counts: countRecords(source),
      files: inventory,
    },
    files,
  }
}

/** Build a portable backup archive; a passphrase encrypts the whole payload. */
export const buildBackupArchive = async (
  source: BackupSource,
  passphrase?: string,
): Promise<string> => {
  const { manifest, files } = await buildManifestAndFiles(source)
  if (!passphrase) {
    const envelope: BackupEnvelope = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      encryption: null,
      manifest,
      files,
      ciphertext: null,
    }
    return JSON.stringify(envelope)
  }
  const encrypted = await encryptArchivePayload(JSON.stringify({ manifest, files }), passphrase)
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    encryption: encrypted.encryption,
    manifest: null,
    files: null,
    ciphertext: encrypted.ciphertext,
  }
  return JSON.stringify(envelope)
}

const verifyFileHashes = async (
  manifest: BackupManifest,
  files: Record<string, string>,
): Promise<BackupFailure | { ok: true }> => {
  for (const entry of manifest.files) {
    const content = files[entry.path]
    if (content === undefined) {
      return failure('checksum', [`missing payload file: ${entry.path}`])
    }
    const bytes = new TextEncoder().encode(content)
    if (bytes.length !== entry.bytes) {
      return failure('checksum', [`payload size mismatch: ${entry.path}`])
    }
    if ((await sha256Hex(bytes)) !== entry.sha256) {
      return failure('checksum', [`payload checksum mismatch: ${entry.path}`])
    }
  }
  return { ok: true }
}

const parsePayloadFiles = (
  files: Record<string, string>,
): BackupFailure | { ok: true; files: Record<string, string> } => {
  const expected = new Set(Object.values(BACKUP_FILE_PATHS))
  const actual = new Set(Object.keys(files))
  if (actual.size !== expected.size || [...expected].some((path) => !actual.has(path))) {
    return failure('manifest', ['backup payload file inventory is incomplete or unexpected'])
  }
  return { ok: true, files }
}

const validatePayload = (
  files: Record<string, string>,
  manifest: BackupManifest,
): BackupFailure | { ok: true; entities: VerifiedBackup['entities']; claims: VerifiedBackup['claims']; canvas: BackupCanvas } => {
  const entitiesFile = parseJson(files[BACKUP_FILE_PATHS.entities]) as { entities?: unknown } | undefined
  const claimsFile = parseJson(files[BACKUP_FILE_PATHS.claims]) as { claims?: unknown } | undefined
  const canvasFile = parseJson(files[BACKUP_FILE_PATHS.canvas]) as BackupCanvas | undefined
  if (entitiesFile === undefined || claimsFile === undefined || canvasFile === undefined) {
    return failure('payload', ['payload file is not valid JSON'])
  }
  const validated = ExportPayloadSchema.safeParse({
    version: manifest.schemaVersion,
    exportedAt: manifest.exportedAt,
    entities: entitiesFile.entities,
    claims: claimsFile.claims,
    graph: canvasFile.graph ?? undefined,
    mindMap: canvasFile.mindMap ?? undefined,
    links: canvasFile.links ?? undefined,
    tags: canvasFile.tags ?? undefined,
  })
  if (!validated.success) {
    return failure(
      'payload',
      validated.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    )
  }
  const entities = validated.data.entities as VerifiedBackup['entities']
  const claims = validated.data.claims as VerifiedBackup['claims']
  const counts = countRecords({
    entities,
    claims,
    graph: validated.data.graph,
    mindMap: validated.data.mindMap,
    links: validated.data.links,
    tags: validated.data.tags,
    appVersion: manifest.appVersion,
  })
  if (JSON.stringify(counts) !== JSON.stringify(manifest.counts)) {
    return failure('counts', ['manifest record counts do not match the payload'])
  }
  const entityIds = new Set<string>()
  for (const entity of entities) {
    if (entityIds.has(entity.id)) {
      return failure('references', [`duplicate entity id: ${entity.id}`])
    }
    entityIds.add(entity.id)
  }
  const claimIds = new Set<string>()
  for (const claim of claims) {
    if (claimIds.has(claim.id) || entityIds.has(claim.id)) {
      return failure('references', [`duplicate record id: ${claim.id}`])
    }
    claimIds.add(claim.id)
    if (!entityIds.has(claim.entityId)) {
      return failure('references', [`claim ${claim.id} references a missing entity: ${claim.entityId}`])
    }
  }
  const referenceErrors: ValidationError[] = []
  for (const edge of validated.data.graph?.edges ?? []) {
    if (!entityIds.has(edge.source) || !entityIds.has(edge.target)) {
      referenceErrors.push({ path: `graph.edges.${edge.id}`, message: 'edge references a missing entity' })
    }
  }
  for (const edge of validated.data.mindMap?.edges ?? []) {
    if (!entityIds.has(edge.source) || !entityIds.has(edge.target)) {
      referenceErrors.push({ path: `mindMap.edges.${edge.id}`, message: 'edge references a missing entity' })
    }
  }
  for (const link of validated.data.links ?? []) {
    if (!entityIds.has(link.sourceId) || !entityIds.has(link.targetId)) {
      referenceErrors.push({ path: `links.${link.id}`, message: 'link references a missing entity' })
    }
  }
  if (referenceErrors.length > 0) {
    return failure('references', referenceErrors.map((error) => `${error.path}: ${error.message}`))
  }
  return {
    ok: true,
    entities,
    claims,
    canvas: {
      graph: validated.data.graph,
      mindMap: validated.data.mindMap,
      links: validated.data.links,
      tags: validated.data.tags,
    },
  }
}

const verifyManifestVersion = (manifest: BackupManifest): BackupFailure | { ok: true } => {
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    return failure('format-version', [
      `unsupported backup format version ${manifest.formatVersion}; this build supports ${BACKUP_FORMAT_VERSION}`,
    ])
  }
  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return failure('schema-version', [
      `backup schema version ${manifest.schemaVersion} is newer than this build (${CURRENT_SCHEMA_VERSION})`,
    ])
  }
  if (manifest.schemaVersion < MIN_SUPPORTED_SCHEMA_VERSION) {
    return failure('schema-version', [
      `backup schema version ${manifest.schemaVersion} is too old to restore safely`,
    ])
  }
  return { ok: true }
}

const decodeEncryptedPayload = async (
  envelope: BackupEnvelope,
  passphrase: string | undefined,
): Promise<BackupFailure | { ok: true; manifest: BackupManifest; files: Record<string, string> }> => {
  if (envelope.encryption === null) {
    return failure('format', ['encrypted backup is missing its encryption header'])
  }
  if (!passphrase) {
    return failure('passphrase-required', ['this backup is encrypted; enter its passphrase'])
  }
  if (envelope.ciphertext === null) {
    return failure('format', ['encrypted backup is missing its ciphertext'])
  }
  let ciphertext: Uint8Array
  try {
    ciphertext = fromBase64(envelope.ciphertext)
  } catch {
    return failure('unreadable', ['backup ciphertext is not valid base64'])
  }
  if ((await sha256Hex(ciphertext)) !== envelope.encryption.ciphertextSha256) {
    return failure('checksum', ['backup ciphertext checksum mismatch'])
  }
  let plaintext: string
  try {
    plaintext = await decryptArchivePayload(ciphertext, envelope.encryption, passphrase)
  } catch {
    return failure('decrypt-failed', [
      'backup could not be decrypted; the passphrase is wrong or the archive was tampered with',
    ])
  }
  const inner = parseJson(plaintext) as { manifest?: unknown; files?: unknown } | undefined
  if (inner === undefined || inner.manifest === undefined || inner.files === undefined) {
    return failure('format', ['decrypted backup payload is malformed'])
  }
  const manifest = ManifestSchema.safeParse(inner.manifest)
  if (!manifest.success) {
    return failure(
      'manifest',
      manifest.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    )
  }
  if (typeof inner.files !== 'object' || inner.files === null || Array.isArray(inner.files)) {
    return failure('payload', ['decrypted payload files are malformed'])
  }
  return { ok: true, manifest: manifest.data, files: inner.files as Record<string, string> }
}

/**
 * Verify and decode an archive. Corrupt, truncated, tampered, future-version,
 * and wrong-passphrase archives all fail before any store mutation.
 */
export const verifyBackupArchive = async (
  raw: string,
  passphrase?: string,
): Promise<{ ok: true; backup: VerifiedBackup } | BackupFailure> => {
  const envelopeValue = parseJson(raw)
  if (envelopeValue === undefined) {
    return failure('unreadable', ['backup file is not valid JSON'])
  }
  const parsed = EnvelopeSchema.safeParse(envelopeValue)
  if (!parsed.success) {
    return failure('format', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`))
  }
  const envelope = parsed.data
  if (envelope.formatVersion > BACKUP_FORMAT_VERSION) {
    return failure('format-version', [
      `unsupported backup format version ${envelope.formatVersion}; this build supports ${BACKUP_FORMAT_VERSION}`,
    ])
  }

  let manifest: BackupManifest
  let files: Record<string, string>
  if (envelope.encryption !== null) {
    const decoded = await decodeEncryptedPayload(envelope, passphrase)
    if (!decoded.ok) return decoded
    manifest = decoded.manifest
    files = decoded.files
  } else {
    if (envelope.manifest === null || envelope.files === null) {
      return failure('format', ['unencrypted backup is missing its manifest or files'])
    }
    manifest = envelope.manifest
    files = envelope.files
  }

  const version = verifyManifestVersion(manifest)
  if (!version.ok) return version
  const inventory = parsePayloadFiles(files)
  if (!inventory.ok) return inventory
  const hashes = await verifyFileHashes(manifest, files)
  if (!hashes.ok) return hashes
  const payload = validatePayload(files, manifest)
  if (!payload.ok) return payload

  return {
    ok: true,
    backup: {
      manifest,
      entities: payload.entities,
      claims: payload.claims,
      graph: payload.canvas.graph,
      mindMap: payload.canvas.mindMap,
      links: payload.canvas.links,
      tags: payload.canvas.tags,
    },
  }
}

/** Re-export the shared payload validator for backup callers. */
export { validateImportPayload }
