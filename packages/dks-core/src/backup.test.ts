import { describe, expect, it } from 'vitest'
import {
  BACKUP_FILE_PATHS,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_KDF_ITERATIONS,
  verifyBackupArchive,
} from './backup.js'

/** Builds a plain archive envelope fixture. */
const makeEnvelope = async (
  overrides: { manifest?: Record<string, unknown>; files?: Record<string, string>; envelope?: Record<string, unknown> } = {},
): Promise<string> => {
  const files = overrides.files ?? {
    [BACKUP_FILE_PATHS.entities]: JSON.stringify({ entities: [] }),
    [BACKUP_FILE_PATHS.claims]: JSON.stringify({ claims: [] }),
    [BACKUP_FILE_PATHS.canvas]: JSON.stringify({ graph: null, mindMap: null, links: null, tags: [] }),
  }
  const manifest = overrides.manifest ?? {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: 1,
    appVersion: '0.2.0',
    exportedAt: '2026-11-17T00:00:00.000Z',
    counts: {
      entities: 0,
      claims: 0,
      graphNodes: 0,
      graphEdges: 0,
      mindMapNodes: 0,
      mindMapEdges: 0,
      links: 0,
      tags: 0,
    },
    files: await Promise.all(
      Object.entries(files).map(async ([path, content]) => ({
        path,
        bytes: new TextEncoder().encode(content).length,
        sha256: await sha256Hex(content),
      })),
    ),
  }
  const envelope = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    encryption: null,
    manifest,
    files,
    ciphertext: null,
    ...(overrides.envelope ?? {}),
  }
  return JSON.stringify(envelope)
}

/** Computes hex sha256 (mirrors the core helper for fixtures). */
const sha256Hex = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Builds a valid plain archive with the given entities/claims. */
const makeValidArchive = async (
  entities: Array<Record<string, unknown>>,
  claims: Array<Record<string, unknown>>,
): Promise<string> => {
  const files = {
    [BACKUP_FILE_PATHS.entities]: JSON.stringify({ entities }),
    [BACKUP_FILE_PATHS.claims]: JSON.stringify({ claims }),
    [BACKUP_FILE_PATHS.canvas]: JSON.stringify({ graph: null, mindMap: null, links: null, tags: [] }),
  }
  const manifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: 1,
    appVersion: '0.2.0',
    exportedAt: '2026-11-17T00:00:00.000Z',
    counts: {
      entities: entities.length,
      claims: claims.length,
      graphNodes: 0,
      graphEdges: 0,
      mindMapNodes: 0,
      mindMapEdges: 0,
      links: 0,
      tags: 0,
    },
    files: await Promise.all(
      Object.entries(files).map(async ([path, content]) => ({
        path,
        bytes: new TextEncoder().encode(content).length,
        sha256: await sha256Hex(content),
      })),
    ),
  }
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    encryption: null,
    manifest,
    files,
    ciphertext: null,
  })
}

describe('verifyBackupArchive (plain)', () => {
  it('verifies a valid empty archive', async () => {
    const r = await verifyBackupArchive(await makeValidArchive([], []))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.entityCount).toBe(0)
    expect(r.claimCount).toBe(0)
    expect(r.encrypted).toBe(false)
  })

  it('verifies counts and references for a populated archive', async () => {
    const archive = await makeValidArchive(
      [{ id: 'e1', name: 'One' }],
      [{ id: 'c1', entityId: 'e1', statement: 'S' }],
    )
    const r = await verifyBackupArchive(archive)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.entityCount).toBe(1)
    expect(r.claimCount).toBe(1)
  })

  it('fails on non-JSON input', async () => {
    const r = await verifyBackupArchive('not json')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('unreadable')
  })

  it('fails on a wrong format marker', async () => {
    const r = await verifyBackupArchive(JSON.stringify({ format: 'other' }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('format')
  })

  it('fails on a future format version', async () => {
    const r = await verifyBackupArchive(await makeEnvelope({ envelope: { formatVersion: 99 } }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('format-version')
  })

  it('fails on a checksum mismatch', async () => {
    const envelope = JSON.parse(await makeEnvelope()) as { manifest: { files: Array<{ sha256: string }> } }
    envelope.manifest.files[0] = { ...envelope.manifest.files[0]!, sha256: '0'.repeat(64) }
    const r = await verifyBackupArchive(JSON.stringify(envelope))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('checksum')
  })

  it('fails when a payload file is missing', async () => {
    const files = {
      [BACKUP_FILE_PATHS.entities]: JSON.stringify({ entities: [] }),
      [BACKUP_FILE_PATHS.claims]: JSON.stringify({ claims: [] }),
    }
    const r = await verifyBackupArchive(await makeEnvelope({ files }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('manifest')
  })

  it('fails on manifest count mismatches', async () => {
    const archive = await makeValidArchive([{ id: 'e1', name: 'One' }], [])
    const envelope = JSON.parse(archive) as { manifest: { counts: { entities: number } } }
    envelope.manifest.counts.entities = 5
    const r = await verifyBackupArchive(JSON.stringify(envelope))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('counts')
  })

  it('fails when a claim references a missing entity', async () => {
    const archive = await makeValidArchive([], [{ id: 'c1', entityId: 'ghost', statement: 'S' }])
    const r = await verifyBackupArchive(archive)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('references')
  })

  it('fails on duplicate entity ids', async () => {
    const archive = await makeValidArchive(
      [
        { id: 'e1', name: 'One' },
        { id: 'e1', name: 'Two' },
      ],
      [],
    )
    const r = await verifyBackupArchive(archive)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('references')
  })
})

/** Minimal encryptor mirroring the studio archive crypto parameters. */
const encryptFixture = async (plaintext: string, passphrase: string): Promise<{ salt: string; iv: string; ciphertext: string; ciphertextSha256: string }> => {
  const subtle = globalThis.crypto.subtle
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const b64 = (bytes: Uint8Array): string => {
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin)
  }
  const keyMaterial = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: BACKUP_KDF_ITERATIONS },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const ciphertext = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, new TextEncoder().encode(plaintext)))
  const digest = new Uint8Array(await subtle.digest('SHA-256', ciphertext))
  return {
    salt: b64(salt),
    iv: b64(iv),
    ciphertext: b64(ciphertext),
    ciphertextSha256: [...digest].map((b) => b.toString(16).padStart(2, '0')).join(''),
  }
}

describe('verifyBackupArchive (encrypted)', () => {
  const makeEncrypted = async (passphrase: string): Promise<string> => {
    const plain = await makeValidArchive([], [])
    const inner = JSON.parse(plain) as { manifest: unknown; files: unknown }
    const enc = await encryptFixture(JSON.stringify({ manifest: inner.manifest, files: inner.files }), passphrase)
    return JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      encryption: {
        algorithm: 'AES-256-GCM',
        kdf: 'PBKDF2-HMAC-SHA256',
        iterations: BACKUP_KDF_ITERATIONS,
        salt: enc.salt,
        iv: enc.iv,
        ciphertextSha256: enc.ciphertextSha256,
      },
      manifest: null,
      files: null,
      ciphertext: enc.ciphertext,
    })
  }

  it('verifies an encrypted archive with the correct passphrase', async () => {
    const archive = await makeEncrypted('correct horse')
    const r = await verifyBackupArchive(archive, 'correct horse')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.encrypted).toBe(true)
  })

  it('requires a passphrase', async () => {
    const archive = await makeEncrypted('correct horse')
    const r = await verifyBackupArchive(archive)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('passphrase-required')
  })

  it('fails with a wrong passphrase', async () => {
    const archive = await makeEncrypted('correct horse')
    const r = await verifyBackupArchive(archive, 'wrong')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('decrypt-failed')
  })
})
