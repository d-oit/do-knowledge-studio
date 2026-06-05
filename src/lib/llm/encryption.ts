const ENCRYPTION_KEY_STORAGE = 'dks:llm-encryption-key';
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Get or create the AES-GCM encryption key.
 * The key is stored in localStorage as a JWK for persistence across sessions.
 */
async function getKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(ENCRYPTION_KEY_STORAGE);
  if (stored) {
    try {
      return await crypto.subtle.importKey(
        'jwk',
        JSON.parse(stored) as JsonWebKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );
    } catch {
      // Key is corrupted, generate a new one
      localStorage.removeItem(ENCRYPTION_KEY_STORAGE);
    }
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const exported = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(ENCRYPTION_KEY_STORAGE, JSON.stringify(exported));
  return key;
}

/**
 * Encrypt a plaintext string using AES-GCM.
 * Returns a prefixed base64 string: `enc:v1:<iv+ciphertext>`
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined));
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

/**
 * Check if a value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}
