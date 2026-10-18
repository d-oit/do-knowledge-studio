import type * as Y from 'yjs'
import { getDeviceId } from './discovery'
import { getSyncDoc } from './doc'

/** Per-record vector clock, keyed by stable device identity. */
export type CausalClock = Record<string, number>
export type RecordKind = 'entities' | 'claims'

const CLOCK_FIELD = '__syncClock'

const recordClock = (kind: RecordKind, id: string): CausalClock => {
  const value = getSyncDoc()[kind].get(id)?.[CLOCK_FIELD]
  return isCausalClock(value) ? value : {}
}

export function isCausalClock(value: unknown): value is CausalClock {
  return typeof value === 'object' && value !== null && !Array.isArray(value) &&
    Object.entries(value).every(([device, counter]) => device.length > 0 &&
      Number.isSafeInteger(counter) && counter >= 0)
}

/** Returns true only when left has observed a strictly later causal version than right. */
export function clockDominates(left: CausalClock, right: CausalClock): boolean {
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

/** Compare vector clocks: -1 left is older, 0 equal, 1 left newer, null concurrent. */
export function compareClocks(left: CausalClock, right: CausalClock): -1 | 0 | 1 | null {
  if (clockDominates(left, right)) return 1
  if (clockDominates(right, left)) return -1
  return Object.entries(left).every(([device, counter]) => counter === (right[device] ?? 0)) &&
    Object.entries(right).every(([device, counter]) => counter === (left[device] ?? 0)) ? 0 : null
}

export function readRecordClock(kind: RecordKind, id: string): CausalClock {
  return recordClock(kind, id)
}

/** Advance a local record version after incorporating the record and any observed delete. */
export function nextRecordClock(observed: CausalClock[], device = getDeviceId()): CausalClock {
  const merged: CausalClock = {}
  for (const clock of observed) {
    for (const [deviceId, counter] of Object.entries(clock)) {
      merged[deviceId] = Math.max(merged[deviceId] ?? 0, counter)
    }
  }
  merged[device] = (merged[device] ?? 0) + 1
  return merged
}

/** Persist a record with a new local causal version in its Yjs map. */
export function setVersionedRecord(
  map: Y.Map<Record<string, unknown>>,
  kind: RecordKind,
  id: string,
  record: Record<string, unknown>,
  tombstoneClock: CausalClock = {},
): CausalClock {
  const clock = nextRecordClock([recordClock(kind, id), tombstoneClock])
  map.set(id, { ...record, [CLOCK_FIELD]: clock })
  return clock
}

export function clockFromRecord(data: Record<string, unknown>): CausalClock {
  return isCausalClock(data[CLOCK_FIELD]) ? data[CLOCK_FIELD] : {}
}
