import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getOrCreateKey, encrypt, decrypt, hasKey, deleteKey } from '../crypto';

describe('Crypto Utilities', () => {
  const TEST_KEY_ID = 'test-encryption-key';

  beforeEach(async () => {
    await deleteKey(TEST_KEY_ID);
  });

  afterEach(async () => {
    await deleteKey(TEST_KEY_ID);
  });

  it('should create and store a non-extractable key', async () => {
    const key = await getOrCreateKey(TEST_KEY_ID);
    expect(key.extractable).toBe(false);
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');

    const exists = await hasKey(TEST_KEY_ID);
    expect(exists).toBe(true);

    const sameKey = await getOrCreateKey(TEST_KEY_ID);
    // When retrieved from IndexedDB, it might not be the exact same object reference
    // but should have the same properties.
    expect(sameKey.extractable).toBe(false);
    expect(sameKey.algorithm.name).toBe('AES-GCM');
  });

  it('should encrypt and decrypt values', async () => {
    const key = await getOrCreateKey(TEST_KEY_ID);
    const plaintext = 'secret message 123';

    const encrypted = await encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');

    const decrypted = await decrypt(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw error when decrypting with wrong key', async () => {
    const key1 = await getOrCreateKey(TEST_KEY_ID);
    const plaintext = 'secret';
    const encrypted = await encrypt(plaintext, key1);

    await deleteKey(TEST_KEY_ID);
    const key2 = await getOrCreateKey(TEST_KEY_ID); // Different key

    await expect(decrypt(encrypted, key2)).rejects.toThrow();
  });
});
