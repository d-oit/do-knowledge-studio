import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  CANONICAL_DB_NAME,
  CANONICAL_DB_VERSION,
  CANONICAL_OBJECT_STORE,
  CANONICAL_RECORD_KEY,
  writeIndexedEnvelope,
  readIndexedEnvelope,
  deleteIndexedEnvelope,
  deleteCanonicalDatabase,
} from './canonical-storage-idb'

describe('canonical-storage-idb', () => {
  beforeEach(async () => {
    await deleteCanonicalDatabase().catch(() => undefined)
  })

  it('exposes stable database constants', () => {
    expect(CANONICAL_DB_NAME).toBe('dks-canonical')
    expect(CANONICAL_DB_VERSION).toBe(2)
    expect(CANONICAL_OBJECT_STORE).toBe('state')
    expect(CANONICAL_RECORD_KEY).toBe('studio-corpus')
  })

  it('writes and reads back an envelope', async () => {
    await writeIndexedEnvelope({ state: { entities: [] }, version: 2 })
    const read = await readIndexedEnvelope()
    expect(read).not.toBeNull()
  })

  it('returns null when nothing is stored', async () => {
    await deleteIndexedEnvelope().catch(() => undefined)
    const read = await readIndexedEnvelope()
    expect(read).toBeNull()
  })

  it('deletes the envelope', async () => {
    await writeIndexedEnvelope({ state: {}, version: 2 })
    await deleteIndexedEnvelope()
    expect(await readIndexedEnvelope()).toBeNull()
  })
})
