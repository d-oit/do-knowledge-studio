/**
 * Scheduled auto-backups (#1136).
 *
 * Pure schedule/rotation logic: cadence gating, timestamped archive naming,
 * and bounded rotation. Callers inject `now`; persistence and download stay
 * in the UI layer so this module is trivially testable.
 */
import { z } from 'zod'

/** Supported auto-backup cadences. */
export const BACKUP_CADENCES = ['off', 'daily', 'weekly'] as const

/** Backup cadence. */
export type BackupCadence = (typeof BACKUP_CADENCES)[number]

/** Zod schema for auto-backup settings. */
export const AutoBackupSettingsSchema = z.object({
  cadence: z.enum(BACKUP_CADENCES),
  keepLast: z.number().int().min(1).max(30),
  lastRunAt: z.string().nullable(),
})

/** Auto-backup settings. */
export type AutoBackupSettings = z.infer<typeof AutoBackupSettingsSchema>

/** Sensible default: weekly, keep 4, never run. */
export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  cadence: 'weekly',
  keepLast: 4,
  lastRunAt: null,
}

/** Milliseconds per cadence step (weekly = 7 days). */
export const CADENCE_INTERVAL_MS: Record<Exclude<BackupCadence, 'off'>, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

/** True when a backup should run now (injectable clock for tests). */
export const isBackupDue = (settings: AutoBackupSettings, now: number = Date.now()): boolean => {
  if (settings.cadence === 'off') return false
  if (settings.lastRunAt === null) return true
  const last = Date.parse(settings.lastRunAt)
  if (Number.isNaN(last)) return true
  return now - last >= CADENCE_INTERVAL_MS[settings.cadence]
}

/** Timestamped archive filename: `dks-backup-YYYYMMDD-HHmmss.json`. */
export const backupFileName = (now: Date = new Date()): string => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  return `dks-backup-${stamp}.json`
}

/** Returns the filenames to delete so only `keepLast` newest survive. */
export const rotationVictims = (existingNewestFirst: string[], keepLast: number): string[] =>
  keepLast <= 0 ? [...existingNewestFirst] : existingNewestFirst.slice(keepLast)
