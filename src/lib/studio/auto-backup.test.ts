import { describe, it, expect } from 'vitest'
import { isBackupDue, backupFileName, rotationVictims, DEFAULT_AUTO_BACKUP_SETTINGS } from './auto-backup'

describe('isBackupDue', () => {
  it('never runs when off', () => {
    expect(isBackupDue({ ...DEFAULT_AUTO_BACKUP_SETTINGS, cadence: 'off' }, Date.now())).toBe(false)
  })

  it('runs once when never run', () => {
    expect(isBackupDue({ ...DEFAULT_AUTO_BACKUP_SETTINGS, lastRunAt: null }, 1_000)).toBe(true)
  })

  it('gates on the cadence interval', () => {
    const last = '2026-11-08T00:00:00.000Z'
    const weekLater = Date.parse('2026-11-15T00:00:00.001Z')
    const sixDays = Date.parse('2026-11-14T00:00:00.000Z')
    expect(isBackupDue({ cadence: 'weekly', keepLast: 4, lastRunAt: last }, weekLater)).toBe(true)
    expect(isBackupDue({ cadence: 'weekly', keepLast: 4, lastRunAt: last }, sixDays)).toBe(false)
  })

  it('treats an unparseable timestamp as due', () => {
    expect(isBackupDue({ cadence: 'daily', keepLast: 4, lastRunAt: 'garbage' }, Date.now())).toBe(true)
  })
})

describe('backupFileName', () => {
  it('emits a sortable UTC stamp', () => {
    expect(backupFileName(new Date('2026-11-15T09:30:05Z'))).toBe('dks-backup-20261115-093005.json')
  })
})

describe('rotationVictims', () => {
  it('keeps the newest N archives', () => {
    expect(rotationVictims(['c', 'b', 'a'], 2)).toEqual(['a'])
    expect(rotationVictims(['c', 'b', 'a'], 5)).toEqual([])
  })
})
