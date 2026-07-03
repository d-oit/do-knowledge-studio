const DB_NAME = 'dks:crypto-store';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

/**
 * Open the IndexedDB database for secure key storage.
 * IndexedDB supports storing CryptoKey objects directly via structured clone.
 */
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

/**
 * Get or create a non-extractable AES-GCM encryption key.
 * By setting extractable to false, the raw key bytes cannot be retrieved
 * via crypto.subtle.exportKey, providing stronger protection against key theft.
 */
export async function getOrCreateKey(id: string, options: { extractable?: boolean } = {}): Promise<CryptoKey> {
  const db = await openDB();
  const stored = await new Promise<{ id: string; key: CryptoKey } | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as { id: string; key: CryptoKey } | undefined);
    request.onerror = () => reject(new Error(String(request.error)));
  });

  if (stored?.key) {
    return stored.key;
  }

  const extractable = options.extractable ?? false;
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });

  return key;
}

/**
 * Import an existing key and store it as a non-extractable key.
 */
export async function importAndStoreKey(id: string, jwk: JsonWebKey, options: { extractable?: boolean } = {}): Promise<CryptoKey> {
  const db = await openDB();
  const extractable = options.extractable ?? false;
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });

  return key;
}

/**
 * Encrypt a plaintext string using AES-GCM and the provided key.
 * Returns a base64 string containing the IV and ciphertext.
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
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

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt an encrypted base64 string using AES-GCM and the provided key.
 */
export async function decrypt(encrypted: string, key: CryptoKey): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Check if a key exists in the store.
 */
export async function hasKey(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count(id);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(new Error(String(request.error)));
  });
}

/**
 * Delete a key from the store.
 */
export async function deleteKey(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(String(tx.error)));
  });
}
