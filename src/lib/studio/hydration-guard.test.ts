import { describe, it, expect } from 'vitest'
import {
  isSyncBlocked,
  recordHydrationRefusal,
  getHydrationRefusal,
  subscribeToHydrationRefusal,
} from './hydration-guard'

describe('hydration-guard', () => {
  it('records a refusal with reason and blocks sync', () => {
    recordHydrationRefusal('test-refusal', null, false)
    expect(isSyncBlocked()).toBe(true)
    expect(getHydrationRefusal()?.reason).toBe('test-refusal')
  })

  it('notifies subscribers on refusal without throwing', () => {
    let notified = 0
    const unsubscribe = subscribeToHydrationRefusal(() => {
      notified += 1
    })
    recordHydrationRefusal('subscriber-check', 'raw-bytes', true)
    expect(notified).toBe(1)
    unsubscribe()
  })

  it('preserves the quarantine payload flag', () => {
    recordHydrationRefusal('quarantine-check', 'partial', true)
    expect(getHydrationRefusal()?.preserved).toBe(true)
  })
})
