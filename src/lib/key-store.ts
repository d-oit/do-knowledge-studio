import { logger } from './logger';

const DB_NAME = 'dks:key-store';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const ENCRYPTION_KEY_ID = '__encryption_key__';
const ENCRYPTED_PREFIX = 'enc:v1:';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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
}

async function getRaw(id: string): Promise<string | null> {
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
}

async function setRaw(id: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });
}

async function deleteRaw(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const stored = await getRaw(ENCRYPTION_KEY_ID);
  if (stored) {
    try {
      return await crypto.subtle.importKey(
        'jwk',
        JSON.parse(stored) as JsonWebKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
    } catch (err) {
      logger.warn('Encryption key is corrupted, generating a new one', err);
      await deleteRaw(ENCRYPTION_KEY_ID);
    }
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const exported = await crypto.subtle.exportKey('jwk', key);
  await setRaw(ENCRYPTION_KEY_ID, JSON.stringify(exported));
  return key;
}

async function encryptValue(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
}

async function decryptValue(encrypted: string): Promise<string> {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    return encrypted;
  }
  const key = await getEncryptionKey();
  const base64 = encrypted.slice(ENCRYPTED_PREFIX.length);
  const combined = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

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
