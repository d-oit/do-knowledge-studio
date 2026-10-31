import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSemanticCache,
  loadSemanticCache,
  resetSemanticCacheConnectionForTests,
  saveSemanticCache,
  SEMANTIC_CACHE_RECORD_KEY,
} from './semantic-cache'

const snapshot = {
  docs: [{ id: 'e1', type: 'entity' as const, name: 'Entity', fullText: 'alpha text' }],
  vectors: [{ id: 'e1', vector: [1, 0, 0] }],
}

const metadata = {
  modelFingerprint: 'model-a',
  dimensions: 3,
  corpusDigest: 'digest-a',
}

describe('semantic cache', () => {
  beforeEach(async () => {
    await clearSemanticCache()
    resetSemanticCacheConnectionForTests()
  })

  it('restores a matching snapshot', async () => {
    await saveSemanticCache(metadata, snapshot)
    expect(await loadSemanticCache(metadata)).toEqual(snapshot)
  })

  it('rejects a snapshot with a different corpus digest', async () => {
    await saveSemanticCache(metadata, snapshot)
    expect(await loadSemanticCache({ ...metadata, corpusDigest: 'digest-b' })).toBeNull()
  })

  it('rejects a snapshot with a different model or preprocessing fingerprint', async () => {
    await saveSemanticCache(metadata, snapshot)
    expect(await loadSemanticCache({ ...metadata, modelFingerprint: 'model-b' })).toBeNull()
  })

  it('deletes an invalid cached record instead of retrying it forever', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('dks-semantic-cache', 1)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains('index')) database.createObjectStore('index')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('index', 'readwrite')
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.objectStore('index').put({ formatVersion: 0 }, SEMANTIC_CACHE_RECORD_KEY)
    })
    db.close()
    resetSemanticCacheConnectionForTests()

    expect(await loadSemanticCache(metadata)).toBeNull()
    expect(await loadSemanticCache(metadata)).toBeNull()
  })

  it('removes the record on explicit clear', async () => {
    await saveSemanticCache(metadata, snapshot)
    await clearSemanticCache()
    expect(await loadSemanticCache(metadata)).toBeNull()
  })
})
