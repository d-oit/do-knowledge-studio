/**
 * Workspace encryption lifecycle: enable, disable, unlock, lock (ADR 048).
 *
 * This is the only module that knows the whole migration sequence. Persistence
 * (`canonical-storage.ts`) only knows how to read and write one record in
 * whichever mode the session is in; the decisions — what to verify, in which
 * order, and what to do when a step fails — live here.
 *
 * The rules the sequence enforces:
 *
 * - **Verify before deleting plaintext.** The encrypted record is written, read
 *   back and decrypted before the legacy plaintext key is removed (the adapter
 *   does that as part of the write) and before the enable flag is set.
 * - **Never half-encrypted.** Revision history moves in one atomic transaction
 *   after each ciphertext was verified in memory; on any failure the originals
 *   are restored from memory.
 * - **Interrupted setup is recoverable.** The corpus salt lives in the envelope
 *   header, so a setup interrupted before the flag was written can be finished
 *   by entering the same passphrase again (see {@link enableWorkspaceEncryption}).
 * - **Secrets stay in memory.** The passphrase is a parameter; it is never
 *   stored, logged, or placed in a URL.
 */
import type { StorageValue } from 'zustand/middleware'
import { useStudioStore } from './store'
import { CURRENT_SCHEMA_VERSION, STUDIO_STORAGE_KEY, partializePersistedState } from './hydration'
import {
  canonicalStudioStorage,
  readCanonicalEnvelope,
  writeCanonicalPlaintextRecord,
} from './canonical-storage'
import { readIndexedRawRecord } from './canonical-storage-idb'
import {
  atRestEnvelopeSalt,
  createAtRestSalt,
  decryptAtRestWithKey,
  deriveAtRestKey,
  isAtRestEnvelope,
} from './at-rest-crypto'
import {
  clearAtRestSalt,
  getAtRestSessionKey,
  installAtRestSessionKey,
  isAtRestEncryptionEnabled,
  lockAtRestSession,
  readAtRestSalt,
  setAtRestEncryptionEnabled,
  writeAtRestSalt,
} from './at-rest-session'
import { corpusFingerprint, sameJson } from './canonical-storage-at-rest'
import { clearHydrationRefusalForVerifiedRecovery } from './hydration-guard'
import { decryptStoredRevisions, encryptStoredRevisions } from './at-rest-revisions'
import { clearAllDrafts } from '@/lib/editor/draft-storage'
import { clearStoredRecoverySnapshot } from './recovery-helpers'
import { clearQuarantine } from './hydration-quarantine'
import { logger } from '@/lib/logging/logger'

/** Subsystem tag for lifecycle logs. */
const log = logger.child({ area: 'store' })

/** Minimum passphrase length accepted when enabling encryption. */
export const MIN_PASSPHRASE_LENGTH = 12

/** Outcome of an enable/disable/unlock attempt. */
export type WorkspaceEncryptionResult = { ok: true } | { ok: false; error: string }

/** Entity count of a stored value, used to verify a resume actually reloaded it. */
const countEntities = (value: unknown): number => {
  const state = (value as { state?: { entities?: unknown[] } } | null)?.state
  return Array.isArray(state?.entities) ? state.entities.length : 0
}

/** Builds the persisted envelope from live store state. */
const currentPersistedValue = (): StorageValue<unknown> => ({
  state: partializePersistedState(useStudioStore.getState()),
  version: CURRENT_SCHEMA_VERSION,
})

/** Writes the public salt and the enable flag, both verified. */
const persistSessionSettings = (salt: Uint8Array): boolean => {
  if (!writeAtRestSalt(salt)) return false
  if (!setAtRestEncryptionEnabled(true)) {
    clearAtRestSalt()
    return false
  }
  return true
}

/**
 * Finishes a setup that was interrupted after the encrypted record landed but
 * before the flag was written: the envelope's own header carries the salt.
 */
const finishInterruptedSetup = async (
  record: unknown,
  passphrase: string,
): Promise<WorkspaceEncryptionResult | null> => {
  if (!isAtRestEnvelope(record)) return null
  const salt = atRestEnvelopeSalt(record)
  if (salt === null) {
    return { ok: false, error: 'The stored encrypted library has an unreadable header.' }
  }
  const key = await deriveAtRestKey(passphrase, salt)
  const outcome = await decryptAtRestWithKey(record, key)
  if (!outcome.ok) {
    return {
      ok: false,
      error:
        'A previously encrypted library is stored on this device and that passphrase ' +
        'does not open it. Re-enter the passphrase used to start encryption.',
    }
  }
  if (!persistSessionSettings(salt)) {
    return { ok: false, error: 'The browser refused to store the encryption settings.' }
  }
  installAtRestSessionKey(key, salt)
  // This page refused to hydrate the record earlier (there was no key), which
  // also latched every write off. The passphrase just proved the corpus is
  // readable, so load it before releasing the latch: releasing first would let
  // the seed workspace in memory overwrite the library on the next keystroke.
  const expectedEntities = countEntities(outcome.value)
  await useStudioStore.persist.rehydrate()
  if (useStudioStore.getState().entities.length !== expectedEntities) {
    return {
      ok: false,
      error:
        'The encrypted library is stored, but this page could not reopen it. ' +
        'Reload the page and enter the same passphrase again.',
    }
  }
  clearHydrationRefusalForVerifiedRecovery()
  return { ok: true }
}

/**
 * Encrypts the whole local workspace with `passphrase`.
 *
 * `confirmation` must match; the UI requires it, and this check is the last
 * line of defence against a typo becoming an unreadable library.
 */
export const enableWorkspaceEncryption = async (
  passphrase: string,
  confirmation: string,
): Promise<WorkspaceEncryptionResult> => {
  if (isAtRestEncryptionEnabled()) {
    return { ok: false, error: 'This workspace is already encrypted. Lock or disable it instead.' }
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_PASSPHRASE_LENGTH} characters for the passphrase.`,
    }
  }
  if (passphrase !== confirmation) {
    return { ok: false, error: 'The two passphrases do not match.' }
  }

  let existing: unknown = null
  try {
    existing = await readIndexedRawRecord()
  } catch {
    // A read failure is not fatal for enabling: the write below verifies itself.
    existing = null
  }
  // Resume BEFORE the hydration guard below. A tab killed mid-setup leaves an
  // encrypted record this page refused to hydrate, so `hasHydrated()` is false
  // in exactly the state the resume path exists to repair — and the resume
  // never touches in-memory state, it re-reads and decrypts the record.
  const resumed = await finishInterruptedSetup(existing, passphrase)
  if (resumed !== null) return resumed

  // Encrypting the in-memory seed workspace before the real library finished
  // loading would replace the stored corpus with demo data. Refuse instead.
  if (!useStudioStore.persist.hasHydrated()) {
    return { ok: false, error: 'The library is still loading. Try again in a moment.' }
  }

  const salt = createAtRestSalt()
  const key = await deriveAtRestKey(passphrase, salt)
  installAtRestSessionKey(key, salt)

  // Source of truth for the migration is the stored corpus when one exists: the
  // in-memory store may not have finished merging it yet, and encrypting seed
  // state over a real library is the one mistake this feature cannot undo.
  const stored = await readCanonicalEnvelope()
  const value = stored ?? currentPersistedValue()
  const fingerprintBefore = await corpusFingerprint(value)

  try {
    // The adapter deliberately swallows storage failures so a keystroke cannot
    // reject into zustand, which means `setItem` resolving proves nothing. Read
    // the RAW record and require an envelope that decrypts to this value: a
    // dropped or downgraded write (full disk, quota, locked browser) must abort
    // here, before any plaintext side surface is purged or the flag is set.
    // Verifying through `readCanonicalEnvelope` is not enough — it happily
    // decodes the previous PLAINTEXT record, so a failed write would look like
    // a successful migration and leave the user locked out on the next load.
    await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, value)
    const written = await readIndexedRawRecord()
    if (!isAtRestEnvelope(written)) {
      throw new Error(
        'the encrypted library could not be stored (the browser may be out of space)',
      )
    }
    const writtenOutcome = await decryptAtRestWithKey(written, key)
    if (!writtenOutcome.ok) {
      throw new Error('the stored encrypted library could not be decrypted')
    }
    if (!sameJson(writtenOutcome.value, value)) {
      throw new Error('the encrypted library does not match the workspace')
    }
    if ((await corpusFingerprint(writtenOutcome.value)) !== fingerprintBefore) {
      throw new Error('the corpus fingerprint changed while encrypting')
    }

    const revisions = await encryptStoredRevisions()
    if (!revisions.ok) throw new Error(revisions.error)

    // Plaintext side surfaces that cannot hold ciphertext are cleared now, not
    // earlier: until this point the migration could still roll back. The Yjs
    // replica is loaded dynamically so the settings bundle does not pull the
    // whole sync stack in just to delete a database.
    clearAllDrafts()
    clearStoredRecoverySnapshot()
    clearQuarantine()
    await import('@/lib/sync/doc')
      .then((module) => module.purgeSyncReplica())
      .catch((purgeError: unknown) => {
        log.warn('The plaintext Yjs replica could not be removed', { error: purgeError })
      })

    if (!persistSessionSettings(salt)) {
      throw new Error('the browser refused to store the encryption settings')
    }
    return { ok: true }
  } catch (error) {
    log.error('Enabling workspace encryption failed; rolling back', { error })
    try {
      await writeCanonicalPlaintextRecord(value)
      const restored = await decryptStoredRevisions()
      if (!restored.ok) log.error('Revision history could not be restored', { error: restored.error })
    } catch (rollbackError) {
      log.error('The plaintext library could not be restored after a failed migration', {
        error: rollbackError,
      })
    }
    setAtRestEncryptionEnabled(false)
    clearAtRestSalt()
    lockAtRestSession()
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Encryption was not enabled: ${error.message}. Your library is unchanged.`
          : 'Encryption was not enabled. Your library is unchanged.',
    }
  }
}

/**
 * Turns encryption off, writing the readable corpus first.
 *
 * Refuses if the workspace is locked or if any revision cannot be decrypted; in
 * both cases nothing is written and the workspace stays encrypted.
 */
export const disableWorkspaceEncryption = async (): Promise<WorkspaceEncryptionResult> => {
  if (!isAtRestEncryptionEnabled()) {
    return { ok: false, error: 'This workspace is not encrypted.' }
  }
  if (getAtRestSessionKey() === null) {
    return { ok: false, error: 'Unlock the workspace before turning encryption off.' }
  }

  const value = await readCanonicalEnvelope()
  if (value === null) {
    return {
      ok: false,
      error: 'The encrypted library could not be read, so encryption was left on.',
    }
  }

  try {
    await writeCanonicalPlaintextRecord(value)
    const revisions = await decryptStoredRevisions()
    if (!revisions.ok) throw new Error(revisions.error)
  } catch (error) {
    log.error('Disabling workspace encryption failed', { error })
    // Put the encrypted record back: the plaintext write may have succeeded, and
    // leaving it there while the flag is still on is a state the reader refuses.
    try {
      await canonicalStudioStorage.setItem(STUDIO_STORAGE_KEY, value)
    } catch (restoreError) {
      log.error('The encrypted library could not be rewritten after a failed disable', {
        error: restoreError,
      })
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Encryption was left on.',
    }
  }

  setAtRestEncryptionEnabled(false)
  clearAtRestSalt()
  lockAtRestSession()
  return { ok: true }
}

/**
 * Unlocks the encrypted workspace and rehydrates the store from it.
 *
 * The key is verified against the stored ciphertext BEFORE it is installed, so a
 * wrong passphrase never reaches the persist layer and never produces a
 * hydration refusal (which would latch writes off for the page).
 */
export const unlockWorkspace = async (passphrase: string): Promise<WorkspaceEncryptionResult> => {
  if (!isAtRestEncryptionEnabled()) {
    return { ok: false, error: 'This workspace is not encrypted.' }
  }
  if (passphrase.length === 0) return { ok: false, error: 'Enter your passphrase.' }

  let record: unknown = null
  try {
    record = await readIndexedRawRecord()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'The encrypted library could not be read.',
    }
  }

  const storedSalt = readAtRestSalt()
  const salt = storedSalt ?? (isAtRestEnvelope(record) ? atRestEnvelopeSalt(record) : null)
  if (salt === null) {
    return { ok: false, error: 'The encryption settings for this workspace are missing.' }
  }

  const key = await deriveAtRestKey(passphrase, salt)
  if (isAtRestEnvelope(record)) {
    const outcome = await decryptAtRestWithKey(record, key)
    if (!outcome.ok) {
      return {
        ok: false,
        error: 'That passphrase does not open this workspace. Nothing was changed.',
      }
    }
  }

  installAtRestSessionKey(key, salt)
  await useStudioStore.persist.rehydrate()
  return { ok: true }
}

/**
 * Locks the workspace: drops the key and the derived caches that hold corpus
 * text or vectors, so a locked tab cannot answer a search from memory.
 *
 * The semantic index is dropped asynchronously (its database is cleared too).
 * Dropping it is a cache eviction, never a corpus change.
 */
export const lockWorkspace = (): void => {
  if (!isAtRestEncryptionEnabled()) return
  lockAtRestSession()
  void import('@/lib/search/vector-store')
    .then((module) => {
      module.resetSemanticCache()
    })
    .catch((error: unknown) => {
      log.warn('Derived semantic caches could not be cleared on lock', { error })
    })
}
