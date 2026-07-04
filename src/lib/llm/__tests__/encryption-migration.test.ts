import { describe, it, expect, beforeEach } from 'vitest';
import { encryptApiKey, decryptApiKey } from '../encryption';
import { deleteKey, hasKey, getOrCreateKey } from '../../crypto';

describe('LLM Encryption Secure Migration', () => {
  const CRYPTO_KEY_ID = 'dks:llm:encryption-key';
  const ENCRYPTION_KEY_STORAGE = 'dks:llm-encryption-key';

  beforeEach(async () => {
    await deleteKey(CRYPTO_KEY_ID);
    localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
  });

  it('should encrypt new API keys using non-extractable keys', async () => {
    const encrypted = await encryptApiKey('test-api-key');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);

    const decrypted = await decryptApiKey(encrypted);
    expect(decrypted).toBe('test-api-key');

    const key = await getOrCreateKey(CRYPTO_KEY_ID);
    expect(key.extractable).toBe(false);
  });

  it('should migrate legacy JWK key from localStorage to secure crypto-store', async () => {
    // 1. Manually put a legacy JWK into localStorage
    const legacyKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const jwk = await crypto.subtle.exportKey('jwk', legacyKey);
    localStorage.setItem(ENCRYPTION_KEY_STORAGE, JSON.stringify(jwk));

    // 2. Encrypt something with the legacy key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode('legacy-api-key');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyKey, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    const legacyEncryptedValue = `enc:v1:${btoa(String.fromCharCode(...combined))}`;

    // 3. Decrypt it — should trigger migration
    const decrypted = await decryptApiKey(legacyEncryptedValue);
    expect(decrypted).toBe('legacy-api-key');

    // 4. Verify migration happened
    expect(await hasKey(CRYPTO_KEY_ID)).toBe(true);
    const secureKey = await getOrCreateKey(CRYPTO_KEY_ID);
    expect(secureKey.extractable).toBe(false);

    // 5. Verify localStorage is cleaned up
    expect(localStorage.getItem(ENCRYPTION_KEY_STORAGE)).toBeNull();
  });
});
