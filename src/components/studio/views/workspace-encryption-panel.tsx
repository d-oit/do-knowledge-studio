'use client'

import { useCallback, useId, useState, type FormEvent } from 'react'
import { KeyRound, Lock, LockOpen, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { translate as t } from '@/lib/i18n/messages/settings'
import { useAtRestSessionStatus } from '@/lib/studio/use-at-rest-session'
import {
  MIN_PASSPHRASE_LENGTH,
  disableWorkspaceEncryption,
  enableWorkspaceEncryption,
  lockWorkspace,
  unlockWorkspace,
  type WorkspaceEncryptionResult,
} from '@/lib/studio/at-rest-workspace'

/** Shared input styling for the passphrase fields. */
const INPUT_CLASS =
  'mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body-lg text-ink ' +
  'placeholder:text-ink-faint focus-ring'

/** Shared action button styling. */
const BUTTON_CLASS =
  'flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 ' +
  'text-label-lg font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-60'

/** One labelled passphrase input. */
const PassphraseField = ({
  id,
  label,
  hint,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (next: string) => void
  autoComplete: string
}) => (
  <div>
    <label htmlFor={id} className="text-label-lg font-medium text-ink-soft">
      {label}
    </label>
    <input
      id={id}
      type="password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className={INPUT_CLASS}
    />
    {hint ? (
      <p id={`${id}-hint`} className="mt-1 text-caption text-ink-faint">
        {hint}
      </p>
    ) : null}
  </div>
)

/**
 * Settings panel for workspace encryption (ADR 048, issue #1162).
 *
 * Enable, unlock, lock and disable all run through `at-rest-workspace`, which
 * owns the migration ordering. This component only collects the passphrase and
 * reports the outcome; it never touches storage or crypto itself.
 */
export const WorkspaceEncryptionPanel = () => {
  const status = useAtRestSessionStatus()
  const [passphrase, setPassphrase] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const baseId = useId()

  const run = useCallback(
    async (
      action: () => Promise<WorkspaceEncryptionResult>,
      successMessage: string,
      resetFields: boolean,
    ) => {
      setBusy(true)
      setError(null)
      try {
        const result = await action()
        if (result.ok) {
          toast.success(successMessage)
          if (resetFields) {
            setPassphrase('')
            setConfirmation('')
          }
        } else {
          setError(result.error)
        }
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const handleEnable = (event: FormEvent) => {
    event.preventDefault()
    void run(
      () => enableWorkspaceEncryption(passphrase, confirmation),
      t('settings.encryption.enabled'),
      true,
    )
  }

  const handleUnlock = (event: FormEvent) => {
    event.preventDefault()
    void run(() => unlockWorkspace(passphrase), t('settings.encryption.unlocked'), true)
  }

  const handleDisable = () => {
    void run(() => disableWorkspaceEncryption(), t('settings.encryption.disabled'), false)
  }

  const handleLock = () => {
    lockWorkspace()
    setError(null)
    toast.success(t('settings.encryption.locked'))
  }

  const statusCopy =
    status === 'off'
      ? t('settings.encryption.statusOff')
      : status === 'locked'
        ? t('settings.encryption.statusLocked')
        : t('settings.encryption.statusUnlocked')

  return (
    <section
      aria-labelledby="settings-encryption-title"
      className="mb-6 rounded-lg border border-border bg-card p-5"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-saffron-soft text-saffron-deep">
          {status === 'unlocked' ? (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Lock className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div>
          <h2
            id="settings-encryption-title"
            className="font-serif text-body-lg font-semibold text-ink"
          >
            {t('settings.encryption.title')}
          </h2>
          <p className="text-label-lg text-ink-mute">{t('settings.encryption.description')}</p>
        </div>
      </div>

      <p role="status" className="mb-3 text-label-lg text-ink-soft">
        {statusCopy}
      </p>

      <p className="mb-1 flex items-start gap-2 text-caption text-ink-faint">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t('settings.encryption.threatModel')}</span>
      </p>
      <p className="mb-3 text-caption text-ink-faint">{t('settings.encryption.exclusions')}</p>

      {status === 'off' ? (
        <form onSubmit={handleEnable} className="space-y-3">
          <p
            role="note"
            className="rounded-md border border-warning-border bg-warning-soft p-3 text-label-lg text-warning-foreground"
          >
            {t('settings.encryption.lossWarning')}
          </p>
          <PassphraseField
            id={`${baseId}-passphrase`}
            label={t('settings.encryption.passphrase')}
            hint={t('settings.encryption.passphraseHint', String(MIN_PASSPHRASE_LENGTH))}
            value={passphrase}
            onChange={setPassphrase}
            autoComplete="new-password"
          />
          <PassphraseField
            id={`${baseId}-confirm`}
            label={t('settings.encryption.confirm')}
            value={confirmation}
            onChange={setConfirmation}
            autoComplete="new-password"
          />
          <p className="text-caption text-ink-faint">{t('settings.encryption.backupHint')}</p>
          <button type="submit" disabled={busy} className={BUTTON_CLASS}>
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.encryption.enable')}
          </button>
        </form>
      ) : null}

      {status === 'locked' ? (
        <form onSubmit={handleUnlock} className="space-y-3">
          <PassphraseField
            id={`${baseId}-unlock`}
            label={t('settings.encryption.passphrase')}
            value={passphrase}
            onChange={setPassphrase}
            autoComplete="current-password"
          />
          <button type="submit" disabled={busy} className={BUTTON_CLASS}>
            <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.encryption.unlock')}
          </button>
        </form>
      ) : null}

      {status === 'unlocked' ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleLock} className={BUTTON_CLASS}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('settings.encryption.lock')}
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className={cn(BUTTON_CLASS)}
          >
            {t('settings.encryption.disable')}
          </button>
        </div>
      ) : null}

      {status === 'unlocked' ? (
        <p className="mt-2 text-caption text-ink-faint">
          {t('settings.encryption.disableHint')}
        </p>
      ) : null}

      {error === null ? null : (
        <p role="alert" className="mt-3 text-label-lg text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
