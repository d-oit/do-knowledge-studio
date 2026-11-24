import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION, STUDIO_STORAGE_KEY, partializePersistedState } from './hydration'
import {
  canonicalStudioStorage,
  readCanonicalEnvelope,
  resetCanonicalStorageForTests,
} from './canonical-storage'
import { readIndexedRawRecord, writeIndexedRawRecord } from './canonical-storage-idb'
import type { AtRestEnvelope } from './at-rest-crypto'
import { lockAtRestSession } from './at-rest-session'
import { enableWorkspaceEncryption } from './at-rest-workspace'
import { useStudioStore } from './store'
import { QUARANTINE_KEY, readQuarantine } from './hydration-quarantine'
import { getHydrationRefusal } from './hydration-guard'
import { isAtRestEnvelope } from './at-rest-crypto'

const PASSPHRASE = 'correct horse battery staple'

/** Runs enable with the current store state. */
const enable = async (): Promise<void> => {
  const result = await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)
  if (!result.ok) throw new Error(result.error)
}

describe('at-rest fail-closed reads', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await resetCanonicalStorageForTests()
    lockAtRestSession()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('refuses a plaintext record while encryption is enabled and never rewrites it', async () => {
    await enable()
    const plaintext = { state: partializePersistedState(useStudioStore.getState()), version: CURRENT_SCHEMA_VERSION }
    await writeIndexedRawRecord(plaintext)

    await expect(canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)).rejects.toThrow(
      /not encrypted/i,
    )

    // Not hydrated, not deleted, not quarantined as readable data.
    expect(await readIndexedRawRecord()).toEqual(plaintext)
    expect(localStorage.getItem(QUARANTINE_KEY)).toBeNull()
  })

  it('refuses an unsupported envelope version without falling back', async () => {
    await enable()
    const stored = (await readIndexedRawRecord()) as AtRestEnvelope
    const future = { ...stored, formatVersion: stored.formatVersion + 1 }
    await writeIndexedRawRecord(future)

    await expect(canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)).rejects.toThrow(
      /unsupported/i,
    )
    expect(await readIndexedRawRecord()).toEqual(future)
    expect(await readCanonicalEnvelope()).toBeNull()
  })

  it('preserves tampered ciphertext for download without copying plaintext aside', async () => {
    await enable()
    const stored = (await readIndexedRawRecord()) as AtRestEnvelope
    const tampered: AtRestEnvelope = {
      ...stored,
      ciphertext: `${stored.ciphertext.slice(0, -4)}AAAA`,
    }
    await writeIndexedRawRecord(tampered)

    // Through the store, so the refusal path runs exactly as it does at boot.
    await useStudioStore.persist.rehydrate()

    expect(getHydrationRefusal()?.preserved).toBe(true)
    // The unreadable record is untouched…
    expect(await readIndexedRawRecord()).toEqual(tampered)
    //…and the quarantine copy is the authenticated envelope, never a corpus.
    const quarantined = readQuarantine()
    expect(quarantined).not.toBeNull()
    expect(isAtRestEnvelope(JSON.parse(quarantined?.raw ?? 'null'))).toBe(true)
    expect(localStorage.getItem(QUARANTINE_KEY)).not.toBeNull()
  })
})
