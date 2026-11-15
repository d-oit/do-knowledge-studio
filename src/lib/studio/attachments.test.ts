import { describe, it, expect } from 'vitest'
import {
  checkAttachmentQuota,
  createAttachmentMeta,
  sha256Hex,
  MAX_ATTACHMENT_BYTES,
  ATTACHMENT_QUOTA_BYTES,
  MAX_ATTACHMENTS_PER_ENTITY,
} from './attachments'

describe('checkAttachmentQuota', () => {
  it('accepts a normal upload', () => {
    expect(checkAttachmentQuota(1024, 0, 0)).toEqual({ ok: true })
  })

  it('rejects oversize files', () => {
    expect(checkAttachmentQuota(MAX_ATTACHMENT_BYTES + 1, 0, 0)).toEqual({ ok: false, reason: 'too-large' })
  })

  it('rejects quota-exceeding uploads', () => {
    expect(checkAttachmentQuota(1024, ATTACHMENT_QUOTA_BYTES, 0)).toEqual({ ok: false, reason: 'quota-exceeded' })
  })

  it('rejects entities at the attachment cap', () => {
    expect(checkAttachmentQuota(1024, 0, MAX_ATTACHMENTS_PER_ENTITY)).toEqual({ ok: false, reason: 'too-many' })
  })
})

describe('createAttachmentMeta', () => {
  it('builds validated metadata', () => {
    const meta = createAttachmentMeta({
      entityId: 'e1',
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      sha256: 'a'.repeat(64),
    })
    expect(meta.id.length).toBeGreaterThan(0)
  })

  it('rejects a bad digest', () => {
    expect(() =>
      createAttachmentMeta({ entityId: 'e1', name: 'x', mimeType: 'text/plain', sizeBytes: 1, sha256: 'nope' }),
    ).toThrow()
  })
})

describe('sha256Hex', () => {
  it('hashes the empty string to the known digest', async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
