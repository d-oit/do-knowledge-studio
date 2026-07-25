import { describe, it, expect } from 'vitest'
import { encryptData, decryptData, buildEncryptedReaderHtml } from './encrypt'

describe('Encrypt module coverage', () => {
  it('encrypts and decrypts data round-trip', async () => {
    const original = JSON.stringify({ entities: [], claims: [] })
    const encrypted = await encryptData(original, 'test-password-123')
    const decrypted = await decryptData(encrypted, 'test-password-123')
    expect(decrypted).toBe(original)
  })

  it('produces different ciphertext for same input (random salt/iv)', async () => {
    const data = 'test data'
    const enc1 = await encryptData(data, 'password')
    const enc2 = await encryptData(data, 'password')
    expect(enc1).not.toBe(enc2)
  })

  it('fails to decrypt with wrong password', async () => {
    const encrypted = await encryptData('secret', 'correct-password')
    await expect(decryptData(encrypted, 'wrong-password')).rejects.toThrow()
  })

  it('encrypted output is valid JSON with expected fields', async () => {
    const encrypted = await encryptData('data', 'password')
    const parsed = JSON.parse(encrypted)
    expect(parsed).toHaveProperty('v', 1)
    expect(parsed).toHaveProperty('salt')
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('data')
    expect(parsed).toHaveProperty('iterations')
  })

  it('buildEncryptedReaderHtml produces valid HTML', () => {
    const html = buildEncryptedReaderHtml('{"v":1,"salt":"test","iv":"test","data":"test","iterations":600000}')
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Encrypted reader')
    expect(html).toContain('AES-256-GCM')
  })

  it('buildEncryptedReaderHtml includes CSP header', () => {
    const html = buildEncryptedReaderHtml('{"v":1}')
    expect(html).toContain('Content-Security-Policy')
  })

  it('buildEncryptedReaderHtml includes decrypt script', () => {
    const html = buildEncryptedReaderHtml('{"v":1}')
    expect(html).toContain('async function decrypt')
    expect(html).toContain('PBKDF2')
  })

  it('encrypt handles empty string', async () => {
    const encrypted = await encryptData('', 'password')
    const decrypted = await decryptData(encrypted, 'password')
    expect(decrypted).toBe('')
  })

  it('encrypt handles large data', async () => {
    const largeData = 'x'.repeat(100000)
    const encrypted = await encryptData(largeData, 'password')
    const decrypted = await decryptData(encrypted, 'password')
    expect(decrypted).toBe(largeData)
  })
})
