import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ICE_SETTINGS_DB_NAME,
  ICE_SETTINGS_RECORD_KEY,
  ICE_SETTINGS_STORE_NAME,
  loadIceServerSettings,
  resetIceSettingsForTests,
  saveIceServerSettings,
} from './ice-settings'

/** TURN configuration used across the cases; the values must never persist as text. */
const TURN_SERVERS = [
  { urls: ['stun:stun.example.com:3478'] },
  { urls: ['turns:relay.example.com:5349'], username: 'relay-user', credential: 'relay-secret' },
]

/** Reads the raw stored record, bypassing the encryption layer. */
const readRawRecord = async (): Promise<unknown> => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(ICE_SETTINGS_DB_NAME)
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction(ICE_SETTINGS_STORE_NAME, 'readonly')
      const request = transaction.objectStore(ICE_SETTINGS_STORE_NAME).get(ICE_SETTINGS_RECORD_KEY)
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
  } finally {
    db.close()
  }
}

beforeEach(() => {
  resetIceSettingsForTests()
  sessionStorage.clear()
})

describe('ice settings storage', () => {
  it('round-trips configured servers within a session', async () => {
    await saveIceServerSettings(TURN_SERVERS)
    expect(await loadIceServerSettings()).toEqual(TURN_SERVERS)
  })

  it('stores ciphertext only: no URL, username or credential is readable at rest', async () => {
    await saveIceServerSettings(TURN_SERVERS)
    const serialized = JSON.stringify(await readRawRecord())
    expect(serialized).not.toContain('relay-secret')
    expect(serialized).not.toContain('relay-user')
    expect(serialized).not.toContain('relay.example.com')
    expect(serialized).toContain('dks-ice-settings')
  })

  it('rejects an invalid configuration instead of storing it', async () => {
    await expect(
      saveIceServerSettings([{ urls: ['turn:relay.example.com:3478'], username: 'u', credential: 'c' }]),
    ).rejects.toThrow(/Plaintext turn/)
  })

  it('returns deployment defaults when nothing is stored', async () => {
    expect(await loadIceServerSettings()).toEqual([])
  })

  it('falls back to deployment defaults when the session key is gone', async () => {
    await saveIceServerSettings(TURN_SERVERS)
    // A new session has no key for the ciphertext: the stored record must not
    // surface as an error, and the credential must not be guessed.
    sessionStorage.clear()
    expect(await loadIceServerSettings()).toEqual([])
  })

  it('ignores a record that does not match the envelope', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(ICE_SETTINGS_DB_NAME, 1)
      request.onupgradeneeded = () => {
        const opened = request.result
        if (!opened.objectStoreNames.contains(ICE_SETTINGS_STORE_NAME)) {
          opened.createObjectStore(ICE_SETTINGS_STORE_NAME)
        }
      }
      request.onsuccess = () => {
        resolve(request.result)
      }
      request.onerror = () => {
        reject(request.error)
      }
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ICE_SETTINGS_STORE_NAME, 'readwrite')
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error)
      }
      transaction.objectStore(ICE_SETTINGS_STORE_NAME).put({ urls: ['plaintext'] }, ICE_SETTINGS_RECORD_KEY)
    })
    db.close()
    resetIceSettingsForTests()

    expect(await loadIceServerSettings()).toEqual([])
  })
})
