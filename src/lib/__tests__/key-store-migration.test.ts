import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { keyStore } from '../key-store';
import { deleteKey, hasKey, getOrCreateKey } from '../crypto';

describe('KeyStore Secure Migration', () => {
  const CRYPTO_KEY_ID = 'dks:key-store:encryption-key';

  beforeEach(async () => {
    await deleteKey(CRYPTO_KEY_ID);
    // Clear the legacy key from IndexedDB if it exists (mocking legacy state)
    const request = indexedDB.open('dks:key-store', 1);
    await new Promise((resolve, reject) => {
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        if (db.objectStoreNames.contains('keys')) {
           const tx = db.transaction('keys', 'readwrite');
           tx.objectStore('keys').delete('__encryption_key__');
           tx.oncomplete = resolve;
        } else {
           resolve(null);
        }
      };
      request.onerror = reject;
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys', { keyPath: 'id' });
        }
      };
    });
  });

  it('should encrypt new values using non-extractable keys', async () => {
    await keyStore.set('test-key', 'test-value');
    const value = await keyStore.get('test-key');
    expect(value).toBe('test-value');

    const key = await getOrCreateKey(CRYPTO_KEY_ID);
    expect(key.extractable).toBe(false);
  });

  it('should migrate legacy JWK key to secure crypto-store', async () => {
    // 1. Manually put a legacy JWK into the old store
    const legacyKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const jwk = await crypto.subtle.exportKey('jwk', legacyKey);

    const openReq = indexedDB.open('dks:key-store', 1);
    await new Promise((resolve) => {
      openReq.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ id: '__encryption_key__', value: JSON.stringify(jwk) });
        tx.oncomplete = resolve;
      };
    });

    // 2. Encrypt something with the legacy key (mocking legacy encrypted data)
    // We need to use the exact same format: enc:v1:<iv+ciphertext>
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode('legacy-data');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyKey, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    const legacyEncryptedValue = 'enc:v1:' + btoa(String.fromCharCode(...combined));

    await new Promise((resolve) => {
      const openReq2 = indexedDB.open('dks:key-store', 1);
      openReq2.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction('keys', 'readwrite');
        tx.objectStore('keys').put({ id: 'legacy-item', value: legacyEncryptedValue });
        tx.oncomplete = resolve;
      };
    });

    // 3. Access the item via keyStore — it should trigger migration and still be able to decrypt
    const value = await keyStore.get('legacy-item');
    expect(value).toBe('legacy-data');

    // 4. Verify migration happened
    const hasSecureKey = await hasKey(CRYPTO_KEY_ID);
    expect(hasSecureKey).toBe(true);
    const secureKey = await getOrCreateKey(CRYPTO_KEY_ID);
    expect(secureKey.extractable).toBe(false);

    // 5. Verify legacy key is gone
    const openReq3 = indexedDB.open('dks:key-store', 1);
    const legacyKeyStored = await new Promise((resolve) => {
       openReq3.onsuccess = (e: any) => {
         const db = e.target.result;
         const tx = db.transaction('keys', 'readonly');
         const req = tx.objectStore('keys').get('__encryption_key__');
         req.onsuccess = () => resolve(req.result);
       };
    });
    expect(legacyKeyStored).toBeUndefined();
  });
});
