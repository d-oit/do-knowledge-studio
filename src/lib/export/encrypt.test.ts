import { describe, it, expect } from 'vitest'
import {
  encryptData,
  decryptData,
  buildEncryptedReaderHtml,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
} from './encrypt'

describe('WebCrypto AES-GCM Encryption', () => {
  it('round-trips: encrypt then decrypt returns original data', async () => {
    const original = JSON.stringify({ hello: 'world', count: 42 })
    const encrypted = await encryptData(original, 'test-password-123')
    const decrypted = await decryptData(encrypted, 'test-password-123')
    expect(decrypted).toBe(original)
  })

  it('wrong password throws on decrypt', async () => {
    const encrypted = await encryptData('secret data', 'correct-password')
    await expect(decryptData(encrypted, 'wrong-password')).rejects.toThrow()
  })

  it('tampered ciphertext throws on decrypt', async () => {
    const encrypted = await encryptData('secret data', 'password')
    const parsed = JSON.parse(encrypted)
    // Tamper with the last char of the data
    parsed.data = parsed.data.slice(0, -2) + 'AA'
    const tampered = JSON.stringify(parsed)
    await expect(decryptData(tampered, 'password')).rejects.toThrow()
  })

  it('produces different ciphertext for same plaintext (random salt+IV)', async () => {
    const enc1 = await encryptData('same data', 'password')
    const enc2 = await encryptData('same data', 'password')
    expect(enc1).not.toBe(enc2)
  })

  it('encrypted payload has correct structure', async () => {
    const encrypted = await encryptData('test', 'pw')
    const parsed = JSON.parse(encrypted)
    expect(parsed.v).toBe(1)
    expect(typeof parsed.salt).toBe('string')
    expect(typeof parsed.iv).toBe('string')
    expect(typeof parsed.data).toBe('string')
    expect(parsed.iterations).toBe(600000)
  })

  it('handles empty string', async () => {
    const encrypted = await encryptData('', 'password')
    const decrypted = await decryptData(encrypted, 'password')
    expect(decrypted).toBe('')
  })

  it('handles unicode content', async () => {
    const original = 'Hello 🌍 — "quotes" & <tags>'
    const encrypted = await encryptData(original, 'password')
    const decrypted = await decryptData(encrypted, 'password')
    expect(decrypted).toBe(original)
  })

  it('handles large payload', async () => {
    const large = 'x'.repeat(100000)
    const encrypted = await encryptData(large, 'password')
    const decrypted = await decryptData(encrypted, 'password')
    expect(decrypted).toBe(large)
  })

  describe('Security: Input validation and Iteration bounds protection', () => {
    it('throws error when payload is not a valid JSON object', async () => {
      await expect(decryptData('null', 'password')).rejects.toThrow('Invalid encrypted payload structure')
      await expect(decryptData('"not-an-object"', 'password')).rejects.toThrow('Invalid encrypted payload structure')
    })

    it('throws error on missing salt', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      delete parsed.salt
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid or missing salt')
    })

    it('throws error on invalid salt type', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      parsed.salt = 123
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid or missing salt')
    })

    it('throws error on missing IV', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      delete parsed.iv
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid or missing IV')
    })

    it('throws error on missing data', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      delete parsed.data
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid or missing data')
    })

    it('throws error on missing iterations', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      delete parsed.iterations
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid iterations parameter')
    })

    it('throws error on non-integer iterations', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      parsed.iterations = 600000.5
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid iterations parameter')
    })

    it('throws error on non-number iterations', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      parsed.iterations = '600000'
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Invalid iterations parameter')
    })

    it('throws error when iterations count is below secure threshold (Downgrade protection)', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      parsed.iterations = 99999
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Iteration count is too low')
    })

    it('throws error when iterations count is above secure threshold (DoS protection)', async () => {
      const encrypted = await encryptData('secret', 'password')
      const parsed = JSON.parse(encrypted)
      parsed.iterations = 10000001
      await expect(decryptData(JSON.stringify(parsed), 'password')).rejects.toThrow('Iteration count exceeds maximum allowable limit')
    })
  })

  it('renders the encrypted reader HTML with current iteration bounds', () => {
    const html = buildEncryptedReaderHtml('{"v":1}')
    expect(html).toContain(`iterations < ${MIN_ITERATIONS}`)
    expect(html).toContain(`iterations > ${MAX_ITERATIONS}`)
  })
})
