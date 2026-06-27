import { logger } from '../logger';
import { getOrCreateKey, encrypt, decrypt, importAndStoreKey, hasKey } from '../crypto';

const ENCRYPTION_KEY_STORAGE = 'dks:llm-encryption-key';
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Get the AES-GCM encryption key from the secure crypto-store.
 * Migrates existing legacy keys from localStorage to IndexedDB.
 */
async function getKey(): Promise<CryptoKey> {
  const CRYPTO_KEY_ID = 'dks:llm:encryption-key';

  try {
    if (await hasKey(CRYPTO_KEY_ID)) {
      return await getOrCreateKey(CRYPTO_KEY_ID, { extractable: false });
    }
  } catch (err) {
    logger.debug('Error checking for key in crypto-store', err);
  }

  try {
    // Fallback to migration from localStorage
    const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
    if (stored) {
      try {
        const jwk = JSON.parse(stored) as JsonWebKey;
        const key = await importAndStoreKey(CRYPTO_KEY_ID, jwk, { extractable: false });
        localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
        logger.info('Migrated LLM encryption key to secure storage');
        return key;
      } catch (migrationErr) {
        logger.warn('Failed to migrate LLM encryption key, generating a new one', migrationErr);
        localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
      }
    }
  } catch (err) {
    logger.debug('No legacy key found in localStorage', err);
  }

  return await getOrCreateKey(CRYPTO_KEY_ID, { extractable: false });
}

/**
 * Encrypt a plaintext string using AES-GCM.
 * Returns a prefixed base64 string: `enc:v1:<iv+ciphertext>`
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const encrypted = await encrypt(plaintext, key);
  return ENCRYPTED_PREFIX + encrypted;
}

/**
 * Decrypt an encrypted string back to plaintext.
 * Supports both encrypted (`enc:v1:...`) and legacy plaintext values.
 * If the value is not encrypted, it returns the raw value (migration path).
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy plaintext key — return as-is for migration
    return encrypted;
  }

  const key = await getKey();
  const ciphertext = encrypted.slice(ENCRYPTED_PREFIX.length);
  return await decrypt(ciphertext, key);
}

/**
 * Check if a value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
