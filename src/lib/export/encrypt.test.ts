import { describe, it, expect } from 'vitest'
import { encryptData, decryptData } from './encrypt'

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
})
