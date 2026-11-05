'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  ExternalLink,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import type { RoomProvider } from '@/lib/sync'
import {
  redactIceServers,
  validateIceServers,
  type IceConfigIssue,
  type IceServerConfig,
} from '@/lib/sync/ice-config'
import { saveIceServerSettings } from '@/lib/sync/ice-settings'
import {
  SYNC_SELF_HOSTING_DOC_URL,
  deriveStagesSnapshot,
  mergeNegotiation,
  readNegotiationSample,
  type NegotiationSample,
  type SyncConnectionHint,
  type SyncConnectionSnapshot,
} from '@/lib/sync/diagnostics'
import { translate as t } from '@/lib/i18n/messages/sync-connection'

/** How often the panel re-reads the connection while a room is active. */
const DIAGNOSTICS_POLL_MS = 3000

/** Message key for every hint; keeps the render free of fallthrough branches. */
const HINT_MESSAGE_KEYS = {
  idle: 'syncConnection.hint.idle',
  'signaling-unreachable': 'syncConnection.hint.signalingUnreachable',
  'no-peers': 'syncConnection.hint.noPeers',
  negotiating: 'syncConnection.hint.negotiating',
  'connected-direct': 'syncConnection.hint.connectedDirect',
  'connected-relay': 'syncConnection.hint.connectedRelay',
  'nat-blocked': 'syncConnection.hint.natBlocked',
  'relay-failed': 'syncConnection.hint.relayFailed',
} as const satisfies Record<SyncConnectionHint, string>

/** How each hint reads at a glance. */
const HINT_TONE: Record<SyncConnectionHint, string> = {
  idle: 'text-ink-faint',
  'signaling-unreachable': 'text-destructive',
  'no-peers': 'text-saffron',
  negotiating: 'text-ink-mute',
  'connected-direct': 'text-emerald-600',
  'connected-relay': 'text-saffron',
  'nat-blocked': 'text-destructive',
  'relay-failed': 'text-destructive',
}

/** One labelled row of the diagnostics table. */
const DiagnosticRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 py-1">
    <dt className="text-body-sm text-ink-mute">{label}</dt>
    <dd className="text-body-sm font-medium text-ink">{value}</dd>
  </div>
)

/** The value both snapshots start from: no ICE statistics read yet. */
const NO_NEGOTIATION: NegotiationSample = { iceState: null, candidateKind: null }

/** True when a fresh ICE read carries the same facts as the previous one. */
const isSameNegotiation = (a: NegotiationSample, b: NegotiationSample): boolean =>
  a.iceState === b.iceState && a.candidateKind === b.candidateKind

/**
 * Builds the diagnostics snapshot: signaling and peer stages render
 * synchronously from props, while ICE statistics are read once and then polled
 * while the room is active. The async read only commits when it changed
 * something, so a room without peer connections never re-renders.
 */
const useConnectionSnapshot = (
  provider: RoomProvider | null,
  peerCount: number,
  active: boolean,
): SyncConnectionSnapshot => {
  const stages = useMemo(() => deriveStagesSnapshot({ provider, peerCount }), [provider, peerCount])
  const [negotiation, setNegotiation] = useState<NegotiationSample>(NO_NEGOTIATION)

  useEffect(() => {
    let cancelled = false
    const read = async (): Promise<void> => {
      const sample = await readNegotiationSample(provider)
      if (cancelled || sample === null) return
      setNegotiation((previous) => (isSameNegotiation(previous, sample) ? previous : sample))
    }
    void read()
    if (!active) {
      return () => {
        cancelled = true
      }
    }
    const timer = setInterval(() => {
      void read()
    }, DIAGNOSTICS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [provider, active])

  return useMemo(() => mergeNegotiation(stages, negotiation), [stages, negotiation])
}

/** Recovery block shown when the direct path is blocked. */
const BlockedNotice = ({ onOpenFileSync }: { onOpenFileSync: () => void }) => (
  <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
    <p className="flex items-center gap-1.5 text-label-lg font-semibold text-destructive">
      <AlertTriangle className="h-4 w-4" />
      {t('syncConnection.blockedTitle')}
    </p>
    <p className="mt-1 text-body-sm text-ink-mute">{t('syncConnection.blockedBody')}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        className="flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-label-lg text-ink hover:bg-muted"
        href={SYNC_SELF_HOSTING_DOC_URL}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {t('syncConnection.selfHosting')}
      </a>
      <button
        type="button"
        className="flex min-h-11 items-center gap-1.5 rounded-md bg-saffron px-3 text-label-lg font-medium text-white hover:opacity-90"
        onClick={onOpenFileSync}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        {t('syncConnection.fileFallback')}
      </button>
    </div>
  </div>
)

/** Diagnostics rows plus the plain-language hint. */
const DiagnosticsSection = ({
  snapshot,
  active,
  onOpenFileSync,
}: {
  snapshot: SyncConnectionSnapshot
  active: boolean
  onOpenFileSync: () => void
}) => {
  const hint: SyncConnectionHint = snapshot.hint
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 font-serif text-body-lg font-semibold text-ink">{t('syncConnection.title')}</h2>
      <p className="mb-3 text-caption text-ink-faint">{t('syncConnection.description')}</p>
      <dl>
        <DiagnosticRow
          label={t('syncConnection.signaling')}
          value={
            !active
              ? t('syncConnection.noRoom')
              : snapshot.signalingReachable
                ? t('syncConnection.signalingReachable')
                : t('syncConnection.signalingUnreachable')
          }
        />
        <DiagnosticRow
          label={t('syncConnection.peers')}
          value={t(
            'syncConnection.peersValue',
            new Intl.NumberFormat().format(snapshot.peersDiscovered),
          )}
        />
        <DiagnosticRow
          label={t('syncConnection.iceState')}
          value={snapshot.iceState ?? t('syncConnection.notNegotiated')}
        />
        <DiagnosticRow
          label={t('syncConnection.candidate')}
          value={snapshot.candidateKind ?? t('syncConnection.notNegotiated')}
        />
      </dl>
      <p className={`mt-2 text-body-sm ${HINT_TONE[hint]}`}>{t(HINT_MESSAGE_KEYS[hint])}</p>
      {snapshot.recommendFileFallback && <BlockedNotice onOpenFileSync={onOpenFileSync} />}
    </section>
  )
}

/** Configured relays, shown without their credential. */
const ConfiguredIceServers = ({
  servers,
  busy,
  onRemove,
}: {
  servers: readonly IceServerConfig[]
  busy: boolean
  onRemove: (index: number) => void
}) => {
  const redacted = redactIceServers(servers)
  if (redacted.length === 0) {
    return <p className="mt-2 text-body-sm text-ink-faint">{t('syncIce.empty')}</p>
  }
  return (
    <ul className="mt-2 space-y-2">
      {redacted.map((server, index) => (
        <li
          key={`${server.urls.join(' ')}-${String(index)}`}
          className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-label text-ink">{server.urls.join(', ')}</p>
            {server.authenticated && (
              <p className="flex items-center gap-1 text-caption text-ink-faint">
                <ShieldCheck className="h-3 w-3" />
                {t('syncIce.authenticated')}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('syncIce.remove')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-muted hover:text-destructive"
            disabled={busy}
            onClick={() => {
              onRemove(index)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** ICE server editor: validates, then persists through the encrypted store. */
const IceSettingsSection = ({
  servers,
  onChange,
}: {
  servers: IceServerConfig[]
  onChange: (servers: IceServerConfig[]) => void
}) => {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [credential, setCredential] = useState('')
  const [allowInsecure, setAllowInsecure] = useState(false)
  const [issues, setIssues] = useState<IceConfigIssue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const persist = useCallback(
    async (next: IceServerConfig[]): Promise<void> => {
      setBusy(true)
      setError(null)
      try {
        await saveIceServerSettings(next)
        setIssues([])
        onChange(next)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t('syncIce.saveFailed'))
      } finally {
        setBusy(false)
      }
    },
    [onChange],
  )

  const handleAdd = useCallback((): void => {
    const draft: IceServerConfig = {
      urls: [url.trim()],
      ...(username.trim() === '' ? {} : { username: username.trim() }),
      ...(credential === '' ? {} : { credential }),
    }
    const verdict = validateIceServers([...servers, draft], { allowInsecureTurn: allowInsecure })
    if (!verdict.ok) {
      setIssues(verdict.issues)
      setError(null)
      return
    }
    void persist(verdict.servers).then(() => {
      setUrl('')
      setUsername('')
      setCredential('')
    })
  }, [url, username, credential, servers, allowInsecure, persist])

  const handleRemove = useCallback(
    (index: number): void => {
      void persist(servers.filter((_, position) => position !== index))
    },
    [servers, persist],
  )

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 font-serif text-body-lg font-semibold text-ink">{t('syncIce.title')}</h2>
      <p className="mb-3 text-caption text-ink-faint">{t('syncIce.description')}</p>
      <ConfiguredIceServers servers={servers} busy={busy} onRemove={handleRemove} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-label text-ink-soft">
          {t('syncIce.url')}
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-body-sm text-ink"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
            }}
            placeholder={t('syncIce.urlPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-label text-ink-soft">
          {t('syncIce.username')}
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-body-sm text-ink"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1 text-label text-ink-soft">
          {t('syncIce.credential')}
          <input
            className="min-h-11 rounded-md border border-border bg-background px-3 text-body-sm text-ink"
            type="password"
            value={credential}
            onChange={(event) => {
              setCredential(event.target.value)
            }}
            autoComplete="new-password"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-body-sm text-ink-soft">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allowInsecure}
            onChange={(event) => {
              setAllowInsecure(event.target.checked)
            }}
          />
          {t('syncIce.allowInsecure')}
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-saffron px-3 text-label-lg font-medium text-white hover:opacity-90 disabled:opacity-60"
          disabled={busy || url.trim() === ''}
          onClick={handleAdd}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {t('syncIce.add')}
        </button>
        <p className="text-caption text-ink-faint">{t('syncIce.envDefaults')}</p>
      </div>

      {issues.length > 0 && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-body-sm text-destructive">
          <p className="font-semibold">{t('syncIce.issueCount', String(issues.length))}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {issues.map((issue) => (
              <li key={`${issue.code}-${String(issue.index)}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}
      {error !== null && <p className="mt-3 text-body-sm text-destructive">{error}</p>}
    </section>
  )
}

/** Diagnostics and ICE configuration for the Sync view (#1052). */
export const SyncConnectionPanel = ({
  provider,
  peerCount,
  roomActive,
  iceServers,
  onIceServersChange,
  onOpenFileSync,
}: {
  provider: RoomProvider | null
  peerCount: number
  roomActive: boolean
  iceServers: IceServerConfig[]
  onIceServersChange: (servers: IceServerConfig[]) => void
  onOpenFileSync: () => void
}) => {
  const snapshot = useConnectionSnapshot(provider, peerCount, roomActive)
  return (
    <>
      <DiagnosticsSection snapshot={snapshot} active={roomActive} onOpenFileSync={onOpenFileSync} />
      <IceSettingsSection servers={iceServers} onChange={onIceServersChange} />
    </>
  )
}
