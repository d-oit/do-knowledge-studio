import { describe, expect, it } from 'vitest'
import {
  BACKUP_FILE_PATHS,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  buildBackupArchive,
  verifyBackupArchive,
  type BackupSource,
} from './archive'
import { buildRestorePreview, composeRestore } from './restore'
import { CURRENT_SCHEMA_VERSION } from '@/lib/studio/migrations'
import type { Entity, Claim } from '@/lib/studio/types'

const entity = (id: string, name: string): Entity => ({
  id,
  name,
  type: 'note',
  description: `${name} description`,
  content: `${name} body`,
  tags: ['backup'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
})

const claim: Claim = {
  id: 'claim-1',
  entityId: 'entity-1',
  statement: 'A verifiable statement',
  evidence: 'Evidence text',
  confidence: 0.8,
  verification: 'verified',
  source: 'https://example.test/source',
  version: 2,
  editHistory: [{ statement: 'Old statement', editedAt: '2026-01-01T00:00:00.000Z' }],
}

const source: BackupSource = {
  entities: [
    entity('entity-1', 'Alpha'),
    entity('entity-2', 'Beta'),
    {
      ...entity('entity-3', 'Custom type'),
      type: 'custom-protocol',
      sourceUrl: 'https://example.test/custom',
    },
  ],
  claims: [claim],
  graph: {
    nodes: [
      { id: 'entity-1', label: 'Alpha', type: 'note', x: 0, y: 0 },
      { id: 'entity-2', label: 'Beta', type: 'note', x: 10, y: 10 },
    ],
    edges: [{ id: 'edge-1', source: 'entity-1', target: 'entity-2', relation: 'relates' }],
  },
  mindMap: {
    nodes: [
      { id: 'entity-1', label: 'Alpha', type: 'note' },
      { id: 'entity-2', label: 'Beta', type: 'note' },
    ],
    edges: [],
  },
  links: [
    {
      id: 'link-1',
      sourceId: 'entity-1',
      targetId: 'entity-2',
      type: 'relates',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  tags: [{ id: 'tag-1', name: 'backup' }],
  appVersion: '0.1.0',
}

const parseEnvelope = (raw: string): Record<string, unknown> =>
  JSON.parse(raw) as Record<string, unknown>

describe('backup archive', () => {
  it('round-trips the full corpus without encryption', async () => {
    const raw = await buildBackupArchive(source)
    const verified = await verifyBackupArchive(raw)

    expect(verified.ok).toBe(true)
    if (!verified.ok) return
    expect(verified.backup.manifest.format).toBe(BACKUP_FORMAT)
    expect(verified.backup.manifest.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(verified.backup.manifest.counts).toMatchObject({
      entities: 3,
      claims: 1,
      graphNodes: 2,
      graphEdges: 1,
      mindMapNodes: 2,
      links: 1,
      tags: 1,
    })
    expect(verified.backup.entities).toEqual(source.entities)
    expect(verified.backup.claims).toEqual(source.claims)
    expect(verified.backup.graph).toEqual(source.graph)
    expect(verified.backup.mindMap).toEqual(source.mindMap)
    expect(verified.backup.links).toEqual(source.links)
    expect(verified.backup.tags).toEqual(source.tags)
  })

  it('round-trips an encrypted archive and refuses a wrong passphrase', async () => {
    const raw = await buildBackupArchive(source, 'correct horse battery staple')
    const envelope = parseEnvelope(raw)
    expect(envelope.ciphertext).toBeTypeOf('string')
    expect(envelope.files).toBeNull()
    expect(raw).not.toContain('A verifiable statement')

    expect(await verifyBackupArchive(raw)).toMatchObject({ ok: false, code: 'passphrase-required' })
    expect(await verifyBackupArchive(raw, 'wrong passphrase')).toMatchObject({
      ok: false,
      code: 'decrypt-failed',
    })
    const verified = await verifyBackupArchive(raw, 'correct horse battery staple')
    expect(verified.ok).toBe(true)
  })

  it('rejects a tampered payload before parsing or store mutation', async () => {
    const raw = await buildBackupArchive(source)
    const envelope = parseEnvelope(raw)
    const files = envelope.files as Record<string, string>
    files[BACKUP_FILE_PATHS.entities] = files[BACKUP_FILE_PATHS.entities].replace('Alpha', 'Tampered')
    const tampered = JSON.stringify(envelope)

    expect(await verifyBackupArchive(tampered)).toMatchObject({ ok: false, code: 'checksum' })
  })

  it('rejects a tampered manifest count', async () => {
    const raw = await buildBackupArchive(source)
    const envelope = parseEnvelope(raw)
    const manifest = envelope.manifest as { counts: Record<string, number> }
    manifest.counts.entities = 99
    expect(await verifyBackupArchive(JSON.stringify(envelope))).toMatchObject({
      ok: false,
      code: 'counts',
    })
  })

  it('rejects truncated, corrupt, and future-version archives', async () => {
    const raw = await buildBackupArchive(source)
    expect(await verifyBackupArchive(raw.slice(0, raw.length / 2))).toMatchObject({
      ok: false,
      code: 'unreadable',
    })

    const futureFormat = parseEnvelope(raw)
    futureFormat.formatVersion = BACKUP_FORMAT_VERSION + 1
    expect(await verifyBackupArchive(JSON.stringify(futureFormat))).toMatchObject({
      ok: false,
      code: 'format-version',
    })

    const futureSchema = parseEnvelope(raw)
    const manifest = futureSchema.manifest as { schemaVersion: number }
    manifest.schemaVersion = CURRENT_SCHEMA_VERSION + 1
    expect(await verifyBackupArchive(JSON.stringify(futureSchema))).toMatchObject({
      ok: false,
      code: 'schema-version',
    })
  })

  it('accepts an older supported schema version with a preview warning', async () => {
    const raw = await buildBackupArchive(source)
    const envelope = parseEnvelope(raw)
    const manifest = envelope.manifest as { schemaVersion: number }
    manifest.schemaVersion = 1
    const verified = await verifyBackupArchive(JSON.stringify(envelope))
    expect(verified.ok).toBe(true)
    if (!verified.ok) return
    const preview = buildRestorePreview(verified.backup, { entities: [], claims: [] })
    expect(preview.warnings.some((warning) => warning.includes('older schema'))).toBe(true)
  })

  it('rejects duplicate ids and dangling references inside the archive', async () => {
    const duplicate = await buildBackupArchive({
      ...source,
      entities: [entity('entity-1', 'Alpha'), entity('entity-1', 'Duplicate')],
      claims: [],
    })
    expect(await verifyBackupArchive(duplicate)).toMatchObject({ ok: false, code: 'references' })

    const dangling = await buildBackupArchive({
      ...source,
      entities: [entity('entity-1', 'Alpha')],
      claims: [{ ...claim, entityId: 'missing-entity' }],
      graph: undefined,
      mindMap: undefined,
      links: undefined,
    })
    expect(await verifyBackupArchive(dangling)).toMatchObject({ ok: false, code: 'references' })
  })

  it('rejects a payload whose file inventory is incomplete', async () => {
    const raw = await buildBackupArchive(source)
    const envelope = parseEnvelope(raw)
    const files = envelope.files as Record<string, string>
    delete files[BACKUP_FILE_PATHS.canvas]
    expect(await verifyBackupArchive(JSON.stringify(envelope))).toMatchObject({
      ok: false,
      code: 'manifest',
    })
  })
})

describe('restore composition', () => {
  const current = { entities: [entity('entity-1', 'Current Alpha')], claims: [] as Claim[] }

  it('replace uses the archive corpus verbatim', async () => {
    const verified = await verifyBackupArchive(await buildBackupArchive(source))
    if (!verified.ok) throw new Error('fixture failed')
    const preview = buildRestorePreview(verified.backup, current)
    const composed = composeRestore(preview, current, { mode: 'replace', duplicatePolicy: 'skip' })

    expect(composed.entities).toEqual(source.entities)
    expect(composed.entities[0].name).toBe('Alpha')
  })

  it('merge skip keeps the current duplicate and appends new records', async () => {
    const verified = await verifyBackupArchive(await buildBackupArchive(source))
    if (!verified.ok) throw new Error('fixture failed')
    const preview = buildRestorePreview(verified.backup, current)
    const composed = composeRestore(preview, current, { mode: 'merge', duplicatePolicy: 'skip' })

    expect(composed.entities.map((record) => record.name)).toEqual(['Current Alpha', 'Beta', 'Custom type'])
    expect(composed.warnings.some((warning) => warning.includes('skipped'))).toBe(true)
  })

  it('merge overwrite replaces duplicate records', async () => {
    const verified = await verifyBackupArchive(await buildBackupArchive(source))
    if (!verified.ok) throw new Error('fixture failed')
    const preview = buildRestorePreview(verified.backup, current)
    const composed = composeRestore(preview, current, { mode: 'merge', duplicatePolicy: 'overwrite' })

    expect(composed.entities.map((record) => record.name)).toEqual(['Alpha', 'Beta', 'Custom type'])
  })
})
