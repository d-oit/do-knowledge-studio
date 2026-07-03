import { logger } from './logger';
import { getOrCreateKey, encrypt, decrypt, importAndStoreKey, hasKey } from './crypto';

const DB_NAME = 'dks:key-store';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const ENCRYPTION_KEY_ID = '__encryption_key__';
const ENCRYPTED_PREFIX = 'enc:v1:';

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error(String(request.error)));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

const getRaw = async (id: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as { id: string; value: string } | undefined;
      resolve(result ? result.value : null);
    };
    request.onerror = () => reject(new Error(String(request.error)));
  });
};

const setRaw = async (id: string, value: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });
};

const deleteRaw = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });
};

/**
 * Get the encryption key for the key-store.
 * Migrates existing legacy keys (stored as JWK in the same DB) to the secure crypto-store.
 */
const getStoreEncryptionKey = async (): Promise<CryptoKey> => {
  // Use a dedicated ID for the key-store's key in the crypto-store
  const CRYPTO_KEY_ID = 'dks:key-store:encryption-key';

  try {
    // Check if we have it in the new store first
    if (await hasKey(CRYPTO_KEY_ID)) {
      return await getOrCreateKey(CRYPTO_KEY_ID, { extractable: false });
    }
  } catch (err) {
    logger.debug('Error checking for key in crypto-store', err);
  }

  try {
    // Check if we have a legacy JWK to migrate
    const legacyJwkString = await getRaw(ENCRYPTION_KEY_ID);
    if (legacyJwkString) {
      try {
        const jwk = JSON.parse(legacyJwkString) as JsonWebKey;
        const key = await importAndStoreKey(CRYPTO_KEY_ID, jwk, { extractable: false });
        // Cleanup legacy JWK from the old store
        await deleteRaw(ENCRYPTION_KEY_ID);
        logger.info('Migrated key-store encryption key to secure storage');
        return key;
      } catch (migrationErr) {
        logger.error('Failed to migrate legacy key-store encryption key', migrationErr);
      }
    }
  } catch (err) {
    logger.debug('No legacy key found or error reading it', err);
  }

  // Final fallback: generate a new key if migration failed or no legacy key exists
  return await getOrCreateKey(CRYPTO_KEY_ID, { extractable: false });
};

const encryptValue = async (plaintext: string): Promise<string> => {
  const key = await getStoreEncryptionKey();
  const encrypted = await encrypt(plaintext, key);
  return ENCRYPTED_PREFIX + encrypted;
};

const decryptValue = async (encrypted: string): Promise<string> => {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    return encrypted;
  }
  const key = await getStoreEncryptionKey();
  const ciphertext = encrypted.slice(ENCRYPTED_PREFIX.length);
  return await decrypt(ciphertext, key);
};

export const keyStore = {
  async get(id: string): Promise<string | null> {
    const raw = await getRaw(id);
    if (!raw) return null;
    try {
      return await decryptValue(raw);
    } catch (err) {
      logger.warn('Failed to decrypt key from store', { id, err });
      return null;
    }
  },

  async set(id: string, value: string): Promise<void> {
    const encrypted = await encryptValue(value);
    await setRaw(id, encrypted);
  },

  async delete(id: string): Promise<void> {
    await deleteRaw(id);
  },

  async has(id: string): Promise<boolean> {
    const raw = await getRaw(id);
    return raw !== null;
  },
};

export async function migrateFromLocalStorage(oldKey: string, newId: string): Promise<boolean> {
  try {
    const value = localStorage.getItem(oldKey);
    if (!value || value.length === 0) return false;
    await keyStore.set(newId, value);
    localStorage.removeItem(oldKey);
    logger.info('Migrated key from localStorage to IndexedDB', { oldKey, newId });
    return true;
  } catch (err) {
    logger.warn('Failed to migrate key from localStorage', { oldKey, err });
    return false;
  }
}
