import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, STUDIO_STORAGE_KEY, partializePersistedState } from './hydration'
import {
  canonicalStudioStorage,
  readCanonicalEnvelope,
  resetCanonicalStorageForTests,
} from './canonical-storage'
import { readAllRevisionRecords, readIndexedRawRecord } from './canonical-storage-idb'
import { corpusFingerprint } from './canonical-storage-at-rest'
import { isAtRestEnvelope } from './at-rest-crypto'
import {
  AT_REST_ENCRYPTION_FLAG_KEY,
  AT_REST_SALT_KEY,
  getAtRestSessionStatus,
  isAtRestEncryptionEnabled,
  lockAtRestSession,
} from './at-rest-session'
import {
  disableWorkspaceEncryption,
  enableWorkspaceEncryption,
  unlockWorkspace,
} from './at-rest-workspace'
import { useStudioStore } from './store'
import { appendEntityRevision, listEntityRevisions } from './revision-storage'
import type { EntityRevision } from './revision-model'
import { describeRecoverySnapshot, persistRecoverySnapshot } from './recovery-helpers'
import { buildRecoverySnapshot } from './recovery-helpers'
import { loadDraft, saveDraft } from '@/lib/editor/draft-storage'
import { getHydrationRefusal, recordHydrationRefusal } from './hydration-guard'

const PASSPHRASE = 'correct horse battery staple'
const MARKER_NAME = 'Secret marker 1162'

/** The persisted value the migration will encrypt. */
const persistedValue = () => ({
  state: partializePersistedState(useStudioStore.getState()),
  version: CURRENT_SCHEMA_VERSION,
})

/** Adds a recognisable entity so plaintext leaks are detectable. */
const installMarker = () => {
  const state = useStudioStore.getState()
  const base = state.entities[0]
  const marker = { ...base, id: 'secret-entity-1162', name: MARKER_NAME }
  useStudioStore.setState({ entities: [...state.entities, marker] })
  return marker
}

/** A revision derived from a valid seed entity, so schema validation passes. */
const makeRevision = (): EntityRevision => {
  const entity = useStudioStore.getState().entities[0]
  return {
    id: 'revision-1162',
    entityId: entity.id,
    createdAt: '2026-11-24T10:00:00.000Z',
    reason: 'save',
    bytes: JSON.stringify(entity).length,
    entity: { ...entity, aliases: entity.aliases ?? [] },
  }
}

/** A schema-valid editor draft fixture. */
const draftFixture = (id: string) => ({
  id,
  entityId: null,
  name: 'Draft',
  content: '',
  description: '',
  type: 'note',
  sourceUrl: '',
  tags: [],
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-24T10:00:00.000Z',
  version: 1,
})

/** Every localStorage value, joined — used to prove no plaintext leaked. */
const allLocalStorageValues = (): string => {
  const values: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    values.push(localStorage.getItem(localStorage.key(index) ?? '') ?? '')
  }
  return values.join('|')
}

describe('workspace encryption lifecycle', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await resetCanonicalStorageForTests()
    lockAtRestSession()
  })

  it('encrypts the corpus without changing it and leaves no plaintext behind', async () => {
    installMarker()
    const before = persistedValue()
    const fingerprintBefore = await corpusFingerprint(before)

    const result = await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)

    expect(result.ok).toBe(true)
    expect(isAtRestEncryptionEnabled()).toBe(true)
    expect(getAtRestSessionStatus()).toBe('unlocked')

    const raw = await readIndexedRawRecord()
    expect(isAtRestEnvelope(raw)).toBe(true)
    // The stored bytes and every localStorage value are free of note text.
    expect(JSON.stringify(raw)).not.toContain(MARKER_NAME)
    expect(allLocalStorageValues()).not.toContain(MARKER_NAME)
    // …and the readable corpus is byte-identical after decryption.
    const decrypted = await readCanonicalEnvelope()
    expect(decrypted).not.toBeNull()
    expect(await corpusFingerprint(decrypted)).toBe(fingerprintBefore)
    expect(getHydrationRefusal()).toBeNull()
  })

  it('never persists the passphrase or the salt as key material', async () => {
    installMarker()
    await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)

    expect(allLocalStorageValues()).not.toContain(PASSPHRASE)
    expect(localStorage.getItem(AT_REST_ENCRYPTION_FLAG_KEY)).toBe('1')
    expect(localStorage.getItem(AT_REST_SALT_KEY)).not.toBeNull()
    expect(localStorage.getItem(AT_REST_SALT_KEY)).not.toBe(PASSPHRASE)
  })

  it('refuses to read or write while locked, then unlocks the same corpus', async () => {
    const marker = installMarker()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const rawBefore = JSON.stringify(await readIndexedRawRecord())

    lockAtRestSession()
    expect(getAtRestSessionStatus()).toBe('locked')

    // A locked read hydrates nothing and does not latch a refusal.
    expect(await canonicalStudioStorage.getItem(STUDIO_STORAGE_KEY)).toBeNull()

    // A locked write is dropped, never stored as plaintext.
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, {
      state: { entities: [{ ...marker, name: 'overwritten while locked' }] },
      version: CURRENT_SCHEMA_VERSION,
    })
    expect(JSON.stringify(await readIndexedRawRecord())).toBe(rawBefore)
    expect(JSON.stringify(await readIndexedRawRecord())).not.toContain('overwritten while locked')

    const unlocked = await unlockWorkspace(PASSPHRASE)
    expect(unlocked.ok).toBe(true)
    expect(getAtRestSessionStatus()).toBe('unlocked')
    expect(
      useStudioStore.getState().entities.some((entity) => entity.name === MARKER_NAME),
    ).toBe(true)
    expect(getHydrationRefusal()).toBeNull()
  })

  it('rejects a wrong passphrase without touching the stored ciphertext', async () => {
    installMarker()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const rawBefore = JSON.stringify(await readIndexedRawRecord())
    lockAtRestSession()

    const result = await unlockWorkspace('not the passphrase')

    expect(result.ok).toBe(false)
    expect(getAtRestSessionStatus()).toBe('locked')
    expect(JSON.stringify(await readIndexedRawRecord())).toBe(rawBefore)
    expect(getHydrationRefusal()).toBeNull()
  })

  it('requires a minimum passphrase and a matching confirmation', async () => {
    expect((await enableWorkspaceEncryption('short', 'short')).ok).toBe(false)
    expect((await enableWorkspaceEncryption(PASSPHRASE, `${PASSPHRASE}x`)).ok).toBe(false)
    expect(isAtRestEncryptionEnabled()).toBe(false)
    expect(await readIndexedRawRecord()).toBeNull()
  })

  it('finishes an interrupted setup and releases the refusal latch it caused', async () => {
    installMarker()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const encryptedRaw = JSON.stringify(await readIndexedRawRecord())

    // Simulate a tab killed after the ciphertext landed but before the settings
    // were written: flag and salt gone, encrypted record still on disk. The next
    // page load refuses to hydrate that record and latches writes off.
    lockAtRestSession()
    localStorage.removeItem(AT_REST_ENCRYPTION_FLAG_KEY)
    localStorage.removeItem(AT_REST_SALT_KEY)
    recordHydrationRefusal('the workspace is locked', null, true)

    const resumed = await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)

    expect(resumed.ok).toBe(true)
    expect(isAtRestEncryptionEnabled()).toBe(true)
    expect(JSON.stringify(await readIndexedRawRecord())).toBe(encryptedRaw)
    // The corpus was reloaded before the latch was released…
    expect(useStudioStore.getState().entities.some((entity) => entity.name === MARKER_NAME)).toBe(
      true,
    )
    expect(getHydrationRefusal()).toBeNull()

    // …and a write now lands as ciphertext instead of being dropped.
    const current = persistedValue()
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, current)
    const rewritten = await readIndexedRawRecord()
    expect(isAtRestEnvelope(rewritten)).toBe(true)
    expect(JSON.stringify(rewritten)).not.toBe(encryptedRaw)
  })

  it('fails closed when the encrypted write is dropped by a full browser store', async () => {
    installMarker()
    const originalPut = IDBObjectStore.prototype.put
    // Fault injection at the browser boundary: every envelope write fails the
    // way a full quota does, while plaintext records still fit.
    IDBObjectStore.prototype.put = function patchedPut(
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (isAtRestEnvelope(value)) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      }
      return originalPut.call(this, value, key)
    } as typeof IDBObjectStore.prototype.put

    try {
      const result = await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected the migration to fail')
      expect(result.error).toMatch(/could not be stored/i)
      expect(isAtRestEncryptionEnabled()).toBe(false)
      expect(localStorage.getItem(AT_REST_SALT_KEY)).toBeNull()
      expect(getAtRestSessionStatus()).toBe('off')
      expect(getHydrationRefusal()).toBeNull()

      // The plaintext corpus is exactly what it was, not a seed fallback.
      const raw = await readIndexedRawRecord()
      expect(isAtRestEnvelope(raw)).toBe(false)
      expect(JSON.stringify(raw)).toContain(MARKER_NAME)
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
  })

  it('encrypts revision history and refuses it while locked', async () => {
    installMarker()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const revision = makeRevision()

    await appendEntityRevision(revision)

    const storedRevisions = JSON.stringify(await readAllRevisionRecords())
    expect(storedRevisions).not.toContain('"entity"')

    const unlockedHistory = await listEntityRevisions(revision.entityId)
    expect(unlockedHistory.map((entry) => entry.id)).toContain(revision.id)

    lockAtRestSession()
    expect(await listEntityRevisions(revision.entityId)).toHaveLength(0)
  })

  it('turns encryption off only after writing the readable corpus back', async () => {
    installMarker()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)
    const before = await readCanonicalEnvelope()

    const result = await disableWorkspaceEncryption()

    expect(result.ok).toBe(true)
    expect(isAtRestEncryptionEnabled()).toBe(false)
    expect(localStorage.getItem(AT_REST_SALT_KEY)).toBeNull()
    expect(getAtRestSessionStatus()).toBe('off')

    const raw = await readIndexedRawRecord()
    expect(isAtRestEnvelope(raw)).toBe(false)
    expect(JSON.stringify(raw)).toContain(MARKER_NAME)
    expect(await readCanonicalEnvelope()).toEqual(before)
  })

  it('suppresses plaintext recovery snapshots while encrypted', async () => {
    const state = useStudioStore.getState()
    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)

    const outcome = persistRecoverySnapshot(buildRecoverySnapshot(state))

    expect(outcome).toEqual({ persisted: false, reason: 'encrypted' })
    expect(describeRecoverySnapshot()).toBeNull()
    expect(localStorage.getItem('do-knowledge-studio-recovery')).toBeNull()
  })

  it('purges plaintext editor drafts when encryption is enabled and stops saving new ones', async () => {
    saveDraft({ ...draftFixture('draft-1162'), content: MARKER_NAME })
    expect(localStorage.getItem('draft:draft-1162')).not.toBeNull()

    expect((await enableWorkspaceEncryption(PASSPHRASE, PASSPHRASE)).ok).toBe(true)

    expect(localStorage.getItem('draft:draft-1162')).toBeNull()
    saveDraft({ ...draftFixture('draft-after-enable'), content: MARKER_NAME })
    expect(localStorage.getItem('draft:draft-after-enable')).toBeNull()
    expect(loadDraft('draft-after-enable')).toBeNull()
  })
})
