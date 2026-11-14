import { describe, expect, it } from 'vitest'
import { makeClaim, makeEntity } from '@/lib/studio/test-helpers'
import {
  MAX_SYNC_BUNDLE_BYTES,
  SYNC_BUNDLE_FORMAT,
  SYNC_BUNDLE_VERSION,
  buildSyncBundle,
  isSyncBundleFileName,
  mergeSyncBundle,
  parseSyncBundle,
  syncBundleFileName,
} from './file-bundle'

const ROOM = 'room-alpha'
const PASSWORD = 'shared passphrase'

const corpus = () => ({
  entities: [
    makeEntity({ id: 'e-1', name: 'Alpha', updatedAt: '2026-01-01T00:00:00.000Z' }),
    makeEntity({ id: 'e-2', name: 'Beta', updatedAt: '2026-01-02T00:00:00.000Z' }),
  ],
  claims: [
    makeClaim({ id: 'c-1', entityId: 'e-1', statement: 'Alpha is first' }),
  ],
})

describe('sync file bundle', () => {
  it('round-trips a plain bundle', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims })
    const result = await parseSyncBundle(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.bundle.roomId).toBe(ROOM)
    expect(result.bundle.entities).toEqual(entities)
    // Validation normalizes optional fields (e.g. an empty editHistory), so
    // compare the meaningful claim fields rather than object identity.
    expect(result.bundle.claims).toHaveLength(claims.length)
    expect(result.bundle.claims[0]).toMatchObject({
      id: claims[0].id,
      entityId: claims[0].entityId,
      statement: claims[0].statement,
    })
  })

  it('round-trips an encrypted bundle and keeps the header readable', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims, password: PASSWORD })
    const header = JSON.parse(text) as { encrypted: boolean; roomId: string; entities?: unknown }
    expect(header.encrypted).toBe(true)
    expect(header.roomId).toBe(ROOM)
    expect(header.entities).toBeUndefined()

    const result = await parseSyncBundle(text, PASSWORD)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.bundle.entities).toEqual(entities)
    expect(result.bundle.claims).toHaveLength(claims.length)
    expect(result.bundle.claims[0]).toMatchObject({
      id: claims[0].id,
      statement: claims[0].statement,
    })
  })

  it('requires a password for an encrypted bundle', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims, password: PASSWORD })
    const result = await parseSyncBundle(text)
    expect(result).toEqual({ ok: false, code: 'password-required' })
  })

  it('rejects a wrong password', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims, password: PASSWORD })
    const result = await parseSyncBundle(text, 'not the password')
    expect(result).toEqual({ ok: false, code: 'decrypt-failed' })
  })

  it('rejects a tampered room id in the header', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims, password: PASSWORD })
    const tampered = text.replace(`"roomId":"${ROOM}"`, '"roomId":"room-other"')
    expect(tampered).not.toBe(text)
    const result = await parseSyncBundle(tampered, PASSWORD)
    expect(result).toEqual({ ok: false, code: 'decrypt-failed' })
  })

  it('rejects an unknown format', async () => {
    const result = await parseSyncBundle(JSON.stringify({ format: 'other', version: 1 }))
    expect(result).toEqual({ ok: false, code: 'unsupported-format' })
  })

  it('rejects an unsupported version', async () => {
    const result = await parseSyncBundle(
      JSON.stringify({ format: SYNC_BUNDLE_FORMAT, version: SYNC_BUNDLE_VERSION + 1 }),
    )
    expect(result).toEqual({ ok: false, code: 'unsupported-version' })
  })

  it('rejects invalid JSON', async () => {
    const result = await parseSyncBundle('{not json')
    expect(result).toEqual({ ok: false, code: 'invalid-json' })
  })

  it('rejects a record that fails the entity schema', async () => {
    const text = JSON.stringify({
      format: SYNC_BUNDLE_FORMAT,
      version: SYNC_BUNDLE_VERSION,
      roomId: ROOM,
      createdAt: '2026-01-01T00:00:00.000Z',
      encrypted: false,
      entities: [{ id: 'broken' }],
      claims: [],
    })
    const result = await parseSyncBundle(text)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('invalid-records')
    expect(result.detail).toBeTruthy()
  })

  it('rejects an oversized bundle before parsing', async () => {
    const result = await parseSyncBundle('x'.repeat(MAX_SYNC_BUNDLE_BYTES + 1))
    expect(result).toEqual({ ok: false, code: 'too-large' })
  })

  it('merges a bundle idempotently', async () => {
    const { entities, claims } = corpus()
    const text = await buildSyncBundle({ roomId: ROOM, entities, claims })
    const parsed = await parseSyncBundle(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const first = mergeSyncBundle(parsed.bundle, [], [])
    expect(first.entities).toHaveLength(2)
    expect(first.conflicts).toHaveLength(0)

    const second = mergeSyncBundle(parsed.bundle, first.entities, first.claims)
    expect(second.entities).toEqual(first.entities)
    expect(second.claims.map((claim) => claim.id)).toEqual(first.claims.map((claim) => claim.id))
    expect(second.claims[0]).toMatchObject({ statement: first.claims[0].statement })
    expect(second.conflicts).toHaveLength(0)
  })

  it('keeps the newer local record and reports the conflict', async () => {
    const local = makeEntity({
      id: 'e-1',
      name: 'Alpha local',
      updatedAt: '2026-02-01T00:00:00.000Z',
    })
    const remote = makeEntity({
      id: 'e-1',
      name: 'Alpha remote',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const result = mergeSyncBundle({ entities: [remote], claims: [] }, [local], [])
    expect(result.entities).toHaveLength(1)
    expect(result.entities[0].name).toBe('Alpha local')
    expect(result.conflicts.length).toBeGreaterThan(0)
  })

  it('names bundle files deterministically and recognises the extension', () => {
    const name = syncBundleFileName('room/alpha', new Date('2026-03-04T05:06:07.000Z'))
    expect(name).toBe('dks-sync-room-alpha-2026-03-04.dksb')
    expect(isSyncBundleFileName(name)).toBe(true)
    expect(isSyncBundleFileName('backup.json')).toBe(false)
  })
})
