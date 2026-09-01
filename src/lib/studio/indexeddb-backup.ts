/**
 * IndexedDB Tiered Storage Backup Module (TRIZ Principle #1 Segmentation & #15 Dynamics).
 * Provides quota-resilient asynchronous backup for knowledge studio snapshots.
 */

import type { RecoverySnapshot } from './recovery-helpers'

const DB_NAME = 'dks-tiered-backup-db'
const DB_VERSION = 1
const STORE_NAME = 'snapshots'
const LATEST_KEY = 'latest-snapshot'

/** Open or initialize the IndexedDB backup database. */
const openBackupDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(new Error(request.error?.message ?? 'Failed to open IndexedDB database.'))
    }
  })
}

/** Asynchronously save a studio recovery snapshot into IndexedDB. */
export const saveIndexedDBSnapshot = async (snapshot: RecoverySnapshot): Promise<boolean> => {
  try {
    const db = await openBackupDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const record = {
          snapshot,
          timestamp: Date.now(),
        }
        const putReq = store.put(record, LATEST_KEY)

        putReq.onsuccess = () => {
          resolve(true)
        }

        putReq.onerror = () => {
          console.error('Failed to write snapshot to IndexedDB:', putReq.error)
          resolve(false)
        }

        tx.oncomplete = () => {
          db.close()
        }
      } catch (txErr) {
        console.error('Transaction error in saveIndexedDBSnapshot:', txErr)
        db.close()
        resolve(false)
      }
    })
  } catch (err) {
    console.warn('IndexedDB backup unavailable:', err instanceof Error ? err.message : err)
    return false
  }
}

/** Asynchronously retrieve the latest recovery snapshot from IndexedDB. */
export const loadIndexedDBSnapshot = async (): Promise<RecoverySnapshot | null> => {
  try {
    const db = await openBackupDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const getReq = store.get(LATEST_KEY)

        getReq.onsuccess = () => {
          const result = getReq.result as { snapshot: RecoverySnapshot; timestamp: number } | undefined
          resolve(result?.snapshot ?? null)
        }

        getReq.onerror = () => {
          console.error('Failed to read snapshot from IndexedDB:', getReq.error)
          resolve(null)
        }

        tx.oncomplete = () => {
          db.close()
        }
      } catch (txErr) {
        console.error('Transaction error in loadIndexedDBSnapshot:', txErr)
        db.close()
        resolve(null)
      }
    })
  } catch (err) {
    console.warn('IndexedDB read unavailable:', err instanceof Error ? err.message : err)
    return null
  }
}

/** Clear all snapshots from the IndexedDB backup store. */
export const clearIndexedDBSnapshots = async (): Promise<boolean> => {
  try {
    const db = await openBackupDatabase()
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const clearReq = store.clear()

        clearReq.onsuccess = () => {
          resolve(true)
        }

        clearReq.onerror = () => {
          console.error('Failed to clear IndexedDB snapshots:', clearReq.error)
          resolve(false)
        }

        tx.oncomplete = () => {
          db.close()
        }
      } catch (txErr) {
        console.error('Transaction error in clearIndexedDBSnapshots:', txErr)
        db.close()
        resolve(false)
      }
    })
  } catch (err) {
    console.warn('IndexedDB clear unavailable:', err instanceof Error ? err.message : err)
    return false
  }
}
