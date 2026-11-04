import 'fake-indexeddb/auto'
import { afterEach, describe, expect } from 'vitest'
import { fc, test } from '@fast-check/vitest'
import { makePropertyEntity } from '@/test/property-test-fixtures'
import { getPropertyTestParameters, getPropertyTestTimeoutMs } from '@/test/property-test-config'
import { permutations } from '@/test/property-test-helpers'
import { destroyBridge, getYjsEntities, mergeIntoYjs, setYjsEntity } from './bridge'
import {
  clockDominates,
  clockFromRecord,
  compareClocks,
  isCausalClock,
  nextRecordClock,
  type CausalClock,
} from './causality'
import { destroy, getSyncDoc, leaveRoom } from './doc'
import { addTombstone, getTombstone, getTombstoneMap, isTombstoned } from './tombstones'

const MAX_DEVICE_ID_LENGTH = 12
const MAX_DEVICE_COUNT = 4
const MAX_CLOCK_COUNTER = 100_000
const FIRST_CLOCK_COUNTER = 1
const FRACTIONAL_CLOCK_COUNTER = 1.5
const SECOND_CLOCK_COUNTER = 2
const MAX_PROPERTY_TEXT_LENGTH = 24
const TOMBSTONE_RECORD_ID = 'property-tombstone-record'
const TOMBSTONE_ROOM_ID = 'room-left'
const TOMBSTONE_DELETED_AT = '2026-01-02T00:00:00.000Z'
const DELETE_DEVICE_ID = 'delete-device'
const EDIT_DEVICE_ID = 'edit-device'
const RESTORE_DEVICE_ID = 'restore-device'
const INHERITED_PROPERTY_DEVICE_IDS = ['__proto__', 'constructor', 'toString'] as const

const clockArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: MAX_DEVICE_ID_LENGTH }),
  fc.integer({ min: 0, max: MAX_CLOCK_COUNTER }),
  { maxKeys: MAX_DEVICE_COUNT },
)

const uuidClockArbitrary = fc.dictionary(
  fc.uuid(),
  fc.integer({ min: 0, max: MAX_CLOCK_COUNTER }),
  { maxKeys: MAX_DEVICE_COUNT },
)

const legacyNextRecordClockForShadow = (observed: CausalClock[], device: string): CausalClock => {
  const merged: CausalClock = {}
  for (const clock of observed) {
    for (const [deviceId, counter] of Object.entries(clock)) {
      merged[deviceId] = Math.max(merged[deviceId] ?? 0, counter)
    }
  }
  merged[device] = (merged[device] ?? 0) + 1
  return merged
}

const legacyClockDominatesForShadow = (left: CausalClock, right: CausalClock): boolean => {
  let advanced = false
  for (const [device, counter] of Object.entries(right)) {
    const leftCounter = left[device] ?? 0
    if (leftCounter < counter) return false
    if (leftCounter > counter) advanced = true
  }
  for (const [device, counter] of Object.entries(left)) {
    if (counter > (right[device] ?? 0)) advanced = true
  }
  return advanced
}

const legacyCompareClocksForShadow = (left: CausalClock, right: CausalClock): -1 | 0 | 1 | null => {
  if (legacyClockDominatesForShadow(left, right)) return 1
  if (legacyClockDominatesForShadow(right, left)) return -1
  return Object.entries(left).every(([device, counter]) => counter === (right[device] ?? 0)) &&
    Object.entries(right).every(([device, counter]) => counter === (left[device] ?? 0)) ? 0 : null
}

const isAtMost = (left: CausalClock, right: CausalClock): boolean => {
  const order = compareClocks(left, right)
  return order === -1 || order === 0
}

const setEntityTombstone = (id: string, clock: CausalClock): void => {
  getTombstoneMap().set(JSON.stringify([TOMBSTONE_ROOM_ID, 'entities', id]), {
    id,
    roomId: TOMBSTONE_ROOM_ID,
    kind: 'entities',
    deletedAt: TOMBSTONE_DELETED_AT,
    deletedBy: DELETE_DEVICE_ID,
    clock,
  })
}

afterEach(() => {
  destroyBridge()
  destroy()
})

describe('causality and tombstone properties', () => {
  test.prop([clockArbitrary], getPropertyTestParameters())(
    'valid vector clocks compare equal to themselves',
    (clock) => {
      expect(isCausalClock(clock)).toBe(true)
      expect(compareClocks(clock, clock)).toBe(0)
      expect(clockDominates(clock, clock)).toBe(false)
    },
    getPropertyTestTimeoutMs(),
  )
  test('rejects malformed vector clocks', () => {
    const malformedClocks: unknown[] = [
      null,
      [],
      'clock',
      { '': FIRST_CLOCK_COUNTER },
      { device: -FIRST_CLOCK_COUNTER },
      { device: FRACTIONAL_CLOCK_COUNTER },
      { device: Number.MAX_SAFE_INTEGER + FIRST_CLOCK_COUNTER },
      { device: '1' },
      { device: Number.NaN },
    ]

    for (const clock of malformedClocks) expect(isCausalClock(clock)).toBe(false)
  })


  test.prop([clockArbitrary, clockArbitrary], getPropertyTestParameters())(
    'clock comparison reverses direction and treats concurrency symmetrically',
    (left, right) => {
      const forward = compareClocks(left, right)
      const reverse = compareClocks(right, left)
      if (forward === null) {
        expect(reverse).toBeNull()
      } else if (forward === 0) {
        expect(reverse).toBe(0)
      } else {
        expect(reverse).toBe(-forward)
      }
    },
    getPropertyTestTimeoutMs(),
  )
  test('clock ordering distinguishes equal, older, newer, and concurrent clocks', () => {
    const older = { 'device-a': FIRST_CLOCK_COUNTER }
    const newer = { 'device-a': SECOND_CLOCK_COUNTER }
    const concurrent = { 'device-b': FIRST_CLOCK_COUNTER }

    expect(clockDominates(newer, older)).toBe(true)
    expect(clockDominates(older, newer)).toBe(false)
    expect(clockDominates(older, older)).toBe(false)
    expect(compareClocks(older, older)).toBe(0)
    expect(compareClocks(newer, older)).toBe(1)
    expect(compareClocks(older, newer)).toBe(-1)
    expect(compareClocks(older, concurrent)).toBeNull()
  })

  test.prop([clockArbitrary, clockArbitrary, clockArbitrary], getPropertyTestParameters())(
    'causal ordering is transitive',
    (oldest, middle, newest) => {
      if (isAtMost(oldest, middle) && isAtMost(middle, newest)) {
        expect(isAtMost(oldest, newest)).toBe(true)
      }
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([fc.array(clockArbitrary, { maxLength: MAX_DEVICE_COUNT }), fc.string({ minLength: 1, maxLength: MAX_DEVICE_ID_LENGTH })], getPropertyTestParameters())(
    'advancing a record clock dominates every observed replica clock',
    (observed, deviceId) => {
      const next = nextRecordClock(observed, deviceId)
      expect(isCausalClock(next)).toBe(true)
      for (const clock of observed) expect(compareClocks(next, clock)).toBe(1)
    },
    getPropertyTestTimeoutMs(),
  )

  test('vector clocks preserve device IDs that shadow inherited object properties', () => {
    for (const deviceId of INHERITED_PROPERTY_DEVICE_IDS) {
      const next = nextRecordClock([], deviceId)
      const observed = { [deviceId]: MAX_CLOCK_COUNTER } satisfies CausalClock
      const nextAfterObservation = nextRecordClock([observed], deviceId)
      const expectedMergedCounter = MAX_CLOCK_COUNTER + FIRST_CLOCK_COUNTER

      expect(isCausalClock(next)).toBe(true)
      expect(next[deviceId]).toBe(FIRST_CLOCK_COUNTER)
      expect(clockDominates(next, {})).toBe(true)
      expect(compareClocks(next, {})).toBe(1)
      expect(nextAfterObservation[deviceId]).toBe(expectedMergedCounter)
      expect(compareClocks(nextAfterObservation, observed)).toBe(1)
      expect(clockDominates(observed, {})).toBe(true)
      expect(compareClocks(observed, {})).toBe(1)
      expect(compareClocks({}, observed)).toBe(-1)

      getSyncDoc().entities.set(TOMBSTONE_RECORD_ID, { __syncClock: nextAfterObservation })
      const roundTripped = clockFromRecord(getSyncDoc().entities.get(TOMBSTONE_RECORD_ID) ?? {})
      expect(isCausalClock(roundTripped)).toBe(true)
      expect(roundTripped[deviceId]).toBe(expectedMergedCounter)
      expect(compareClocks(roundTripped, observed)).toBe(1)
    }
  })


  test.prop([fc.array(clockArbitrary, { minLength: 2, maxLength: 3 })], getPropertyTestParameters())(
    'joining two or three replica clocks is independent of input order',
    (replicaClocks) => {
      const joined = permutations(replicaClocks).map((clocks) => nextRecordClock(clocks, RESTORE_DEVICE_ID))
      for (const clock of joined.slice(1)) expect(clock).toEqual(joined[0])
    },
    getPropertyTestTimeoutMs(),
  )
  test.prop([
    fc.array(uuidClockArbitrary, { maxLength: MAX_DEVICE_COUNT }),
    fc.uuid(),
    uuidClockArbitrary,
    uuidClockArbitrary,
  ], getPropertyTestParameters())(
    'matches the previous clock behavior for UUID device IDs in shadow comparison',
    (observed, deviceId, left, right) => {
      const next = nextRecordClock(observed, deviceId)
      const previousNext = legacyNextRecordClockForShadow(observed, deviceId)

      expect(Object.entries(next)).toEqual(Object.entries(previousNext))
      expect(clockDominates(left, right)).toBe(legacyClockDominatesForShadow(left, right))
      expect(compareClocks(left, right)).toBe(legacyCompareClocksForShadow(left, right))
    },
    getPropertyTestTimeoutMs(),
  )


  test.prop([fc.integer({ min: 0, max: MAX_CLOCK_COUNTER })], getPropertyTestParameters())(
    'a deletion hides the stale version, leaves concurrent edits visible, and permits a causal restore after leaving',
    (counter) => {
      destroyBridge()
      destroy()
      try {
        const baseClock = { 'base-device': counter }
        const deleteClock = nextRecordClock([baseClock], DELETE_DEVICE_ID)
        const concurrentEditClock = nextRecordClock([baseClock], EDIT_DEVICE_ID)
        const restoredClock = nextRecordClock([deleteClock], RESTORE_DEVICE_ID)
        setEntityTombstone(TOMBSTONE_RECORD_ID, deleteClock)

        expect(isTombstoned(TOMBSTONE_RECORD_ID, 'entities', baseClock)).toBe(true)
        expect(compareClocks(concurrentEditClock, deleteClock)).toBeNull()
        expect(isTombstoned(TOMBSTONE_RECORD_ID, 'entities', concurrentEditClock)).toBe(false)
        expect(compareClocks(restoredClock, deleteClock)).toBe(1)
        expect(isTombstoned(TOMBSTONE_RECORD_ID, 'entities', restoredClock)).toBe(false)

        const entity = makePropertyEntity({
          id: TOMBSTONE_RECORD_ID,
          name: 'Stale copy',
          createdAt: TOMBSTONE_DELETED_AT,
          updatedAt: TOMBSTONE_DELETED_AT,
        })
        getSyncDoc().entities.set(entity.id, { ...entity, __syncClock: baseClock })
        leaveRoom()
        expect(getTombstone(entity.id)?.roomId).toBe(TOMBSTONE_ROOM_ID)
        setYjsEntity({ ...entity, name: 'Restored after leave' })
        const restoredRecord = getSyncDoc().entities.get(entity.id)
        const actualClock = clockFromRecord(restoredRecord ?? {})
        expect(compareClocks(actualClock, deleteClock)).toBe(1)
        expect(getYjsEntities()).toContainEqual({ ...entity, name: 'Restored after leave' })
      } finally {
        destroyBridge()
        destroy()
      }
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([fc.integer({ min: 0, max: MAX_CLOCK_COUNTER })], getPropertyTestParameters())(
    'concurrent record and delete operations surface a conflict through the bridge',
    (counter) => {
      destroyBridge()
      destroy()
      try {
        const entity = makePropertyEntity({ id: TOMBSTONE_RECORD_ID })
        const baseClock = { 'base-device': counter }
        const concurrentClock = nextRecordClock([baseClock], EDIT_DEVICE_ID)
        const deleteClock = nextRecordClock([baseClock], DELETE_DEVICE_ID)
        getSyncDoc().entities.set(entity.id, { ...entity, __syncClock: concurrentClock })
        setEntityTombstone(entity.id, deleteClock)

        const result = mergeIntoYjs([], [])
        expect(result.conflicts.map((conflict) => conflict.field)).toContain('__delete')
        expect(getYjsEntities()).toContainEqual(entity)
      } finally {
        destroyBridge()
        destroy()
      }
    },
    getPropertyTestTimeoutMs(),
  )

  test.prop([fc.string({ minLength: 1, maxLength: MAX_PROPERTY_TEXT_LENGTH })], getPropertyTestParameters())(
    'tombstones remain isolated by record kind for arbitrary IDs',
    (id) => {
      destroy()
      try {
        addTombstone(id, undefined, 'entities')
        const tombstone = getTombstone(id, 'entities')
        expect(tombstone?.kind).toBe('entities')
        expect(isTombstoned(id, 'entities')).toBe(true)
        expect(isTombstoned(id, 'claims')).toBe(false)
        expect(Number.isFinite(Date.parse(tombstone?.deletedAt ?? ''))).toBe(true)
      } finally {
        destroy()
      }
    },
    getPropertyTestTimeoutMs(),
  )
})
