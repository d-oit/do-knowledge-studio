import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  decryptRoomPayload,
  deriveRoomKeyFingerprint,
  encryptRoomPayload,
  SYNC_ENVELOPE_VERSION,
} from './security'

describe('sync room encryption contract', () => {
  it('derives a deterministic fingerprint per room and password', async () => {
    const first = await deriveRoomKeyFingerprint('room-a', 'shared password')
    const second = await deriveRoomKeyFingerprint('room-a', 'shared password')
    expect(first).toBe(second)
    expect(first).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/)
  })

  it('salts with the room name and separates passwords', async () => {
    const base = await deriveRoomKeyFingerprint('room-a', 'shared password')
    expect(await deriveRoomKeyFingerprint('room-b', 'shared password')).not.toBe(base)
    expect(await deriveRoomKeyFingerprint('room-a', 'different password')).not.toBe(base)
  })

  it('round-trips a payload and uses a fresh IV per encryption', async () => {
    const first = await encryptRoomPayload('room-a', 'shared password', 'secret corpus')
    const second = await encryptRoomPayload('room-a', 'shared password', 'secret corpus')
    expect(first.data).not.toBe(second.data)
    await expect(decryptRoomPayload('room-a', 'shared password', first)).resolves.toBe('secret corpus')
  })

  it('rejects a wrong password, a different room, corruption, and a future envelope', async () => {
    const envelope = await encryptRoomPayload('room-a', 'shared password', 'secret corpus')
    await expect(decryptRoomPayload('room-a', 'wrong password', envelope)).rejects.toThrow()
    await expect(decryptRoomPayload('room-b', 'shared password', envelope)).rejects.toThrow()

    const corrupted = { ...envelope, data: `${envelope.data.slice(0, -4)}AAAA` }
    await expect(decryptRoomPayload('room-a', 'shared password', corrupted)).rejects.toThrow()

    await expect(
      decryptRoomPayload('room-a', 'shared password', {
        ...envelope,
        v: SYNC_ENVELOPE_VERSION + 1,
      }),
    ).rejects.toThrow(/Unsupported sync envelope version/)
  })

  it('keeps duplicate delivery idempotent at the Yjs layer', () => {
    const source = new Y.Doc()
    source.getMap('entities').set('entity-1', { name: 'Alpha' })
    const update = Y.encodeStateAsUpdate(source)
    const target = new Y.Doc()
    Y.applyUpdate(target, update)
    const afterFirst = Y.encodeStateAsUpdate(target)
    Y.applyUpdate(target, update)
    expect(Y.encodeStateAsUpdate(target)).toEqual(afterFirst)
    expect(target.getMap('entities').get('entity-1')).toEqual({ name: 'Alpha' })
  })
})
