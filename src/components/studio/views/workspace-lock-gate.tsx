'use client'

import { useId, useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'
import { translate as t } from '@/lib/i18n/messages/settings'
import { useAtRestSessionStatus } from '@/lib/studio/use-at-rest-session'
import { unlockWorkspace } from '@/lib/studio/at-rest-workspace'

/**
 * Blocking unlock screen for an encrypted, locked workspace (ADR 048 §4).
 *
 * While it is up the store holds no corpus: the persistence adapter returns
 * null for the encrypted record and refuses writes, so this screen is the only
 * way to make the library readable again in this tab. It covers the shell so a
 * user cannot mistake the empty workspace behind it for a lost library.
 */
export const WorkspaceLockGate = () => {
  const status = useAtRestSessionStatus()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputId = useId()

  if (status !== 'locked') return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await unlockWorkspace(passphrase)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setPassphrase('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-6 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-lock-title"
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-saffron-deep" aria-hidden="true" />
          <h1 id="workspace-lock-title" className="font-serif text-body-lg font-semibold text-ink">
            {t('settings.encryption.lockScreenTitle')}
          </h1>
        </div>
        <p className="text-label-lg text-ink-mute">{t('settings.encryption.lockScreenBody')}</p>

        <label htmlFor={inputId} className="mt-4 block text-label-lg font-medium text-ink-soft">
          {t('settings.encryption.passphrase')}
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-body-lg text-ink focus-ring"
        />

        {error === null ? null : (
          <p role="alert" className="mt-2 text-label-lg text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-3 flex min-h-touch w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-label-lg font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('settings.encryption.lockScreenSubmit')}
        </button>
      </form>
    </div>
  )
}
