'use client'

import { useCallback, useEffect, useState } from 'react'
import { Database, Gauge, HardDrive, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ViewHeader, VIEW_CONTAINER_CLASS } from '../ui/shared-primitives'
import { cn } from '@/lib/utils'
import { translate as t } from '@/lib/i18n/messages/settings'
import {
  clearModelCache,
  estimateUsagePercent,
  formatBytes,
  isNearQuota,
  readModelCacheUsage,
  readOriginStorage,
  requestPersistence,
  type ModelCacheUsage,
  type OriginStorageState,
} from '@/lib/studio/storage-report'
import {
  defaultVectorStore,
  getSemanticIndexProgress,
  resetSemanticCache,
  SEMANTIC_INDEX_MAX_BYTES,
} from '@/lib/search/vector-store'

/** Snapshot of the semantic index, read on demand rather than subscribed. */
interface SemanticUsage {
  documents: number
  bytes: number
  budgetBytes: number
  status: string
}

/** One measured row in a usage table. */
const UsageRow = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt className="text-ink-mute">{label}</dt>
    <dd className="text-right font-medium text-ink">{value}</dd>
  </>
)

/** A usage table with its two numeric rows. */
const UsageList = ({
  rows,
}: {
  rows: { label: string; value: string }[]
}) => (
  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border bg-background p-3 text-label-lg">
    {rows.map((row) => (
      <UsageRow key={row.label} label={row.label} value={row.value} />
    ))}
  </dl>
)

/** Card header shared by the semantic-index, origin-storage and model-cache sections. */
const SectionHeading = ({
  icon: Icon,
  title,
  description,
  headingId,
}: {
  icon: typeof Database
  title: string
  description: string
  headingId?: string
}) => (
  <div className="mb-3 flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-saffron-soft text-saffron-deep">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </div>
    <div>
      <h2 id={headingId} className="font-serif text-body-lg font-semibold text-ink">{title}</h2>
      <p className="text-label-lg text-ink-mute">{description}</p>
    </div>
  </div>
)

/** Primary action button for a destructive-but-rebuildable operation. */
const PanelButton = ({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof Trash2
  label: string
  onClick: () => void
  disabled?: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'mt-3 flex min-h-touch items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2',
      'text-label-lg font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring',
      disabled && 'cursor-not-allowed opacity-60 hover:border-border',
    )}
  >
    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    {label}
  </button>
)

/**
 * Settings view reports browser origin quota/persistence plus the sizes of two
 * derived stores. Values are read in an effect, never during render: the
 * Storage API, Cache Storage and vector store only exist in the browser.
 */
export const SettingsView = () => {
  const [modelUsage, setModelUsage] = useState<ModelCacheUsage | null>(null)
  const [semantic, setSemantic] = useState<SemanticUsage | null>(null)
  const [origin, setOrigin] = useState<OriginStorageState | null>(null)
  const [requestingPersist, setRequestingPersist] = useState(false)

  const refresh = useCallback(async () => {
    const [usage, originState] = await Promise.all([readModelCacheUsage(), readOriginStorage()])
    setModelUsage(usage)
    setOrigin(originState)
    const progress = getSemanticIndexProgress()
    setSemantic({
      documents: defaultVectorStore.size,
      bytes: defaultVectorStore.getMemoryBytes(),
      budgetBytes: SEMANTIC_INDEX_MAX_BYTES,
      status: progress.status,
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Drops the in-memory index and its IndexedDB cache; the next search rebuilds. */
  const handleRebuild = useCallback(() => {
    resetSemanticCache()
    void refresh()
    toast.success(t('settings.semantic.rebuilt'))
  }, [refresh])

  /** Deletes the model cache so a re-download is forced. */
  const handleClearModelCache = useCallback(async () => {
    const deleted = await clearModelCache()
    await refresh()
    if (deleted) {
      toast.success(t('settings.model.cleared'))
    } else {
      toast.info(t('settings.model.empty'))
    }
  }, [refresh])

  /** Requests browser protection against eviction; the browser may decline. */
  const handleRequestPersistence = useCallback(async () => {
    setRequestingPersist(true)
    try {
      const result = await requestPersistence()
      const fresh = await readOriginStorage()
      setOrigin(fresh)
      if (result.supported && result.granted) {
        toast.success(t('settings.origin.persistGranted'))
      } else if (result.supported) {
        toast.info(t('settings.origin.persistDenied'))
      } else {
        toast.info(t('settings.origin.persistUnavailable'))
      }
    } finally {
      setRequestingPersist(false)
    }
  }, [])

  const originPercent = estimateUsagePercent(origin?.estimate ?? null)

  const storageAvailable = modelUsage?.available ?? true

  return (
    <div className={cn(VIEW_CONTAINER_CLASS, 'max-w-3xl')}>
      <ViewHeader
        icon={HardDrive}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      {!storageAvailable && (
        <p role="status" className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-label-lg text-ink-mute">
          {t('settings.unavailable')}
        </p>
      )}
      <section
        aria-labelledby="settings-origin-title"
        className="mb-6 rounded-lg border border-border bg-card p-5"
      >
        <SectionHeading
          icon={Gauge}
          headingId="settings-origin-title"
          title={t('settings.origin.title')}
          description={t('settings.origin.description')}
        />

        {origin === null ? null : !origin.supported ? (
          <p
            role="status"
            className="rounded-md border border-border bg-muted/40 p-3 text-label-lg text-ink-mute"
          >
            {t('settings.origin.unsupported')}
          </p>
        ) : (
          <>
            {origin.estimate === null ? (
              <p
                role="status"
                className="rounded-md border border-border bg-muted/40 p-3 text-label-lg text-ink-mute"
              >
                {t('settings.origin.measureFailed')}
              </p>
            ) : (
              <>
                <UsageList
                  rows={[
                    {
                      label: t('settings.origin.usage'),
                      value:
                        origin.estimate.usageBytes === null
                          ? t('settings.origin.valueUnavailable')
                          : formatBytes(origin.estimate.usageBytes),
                    },
                    {
                      label: t('settings.origin.quota'),
                      value:
                        origin.estimate.quotaBytes === null
                          ? t('settings.origin.valueUnavailable')
                          : formatBytes(origin.estimate.quotaBytes),
                    },
                  ]}
                />
                <p className="mt-2 text-caption text-ink-faint">
                  {t('settings.origin.estimatesHint')}
                </p>
                <p className="mt-1.5 text-caption text-ink-faint">
                  {t('settings.origin.coverage')}
                </p>
              </>
            )}

            {isNearQuota(origin.estimate) && originPercent !== null && (
              <div
                role="status"
                className="mt-3 flex items-start gap-2 rounded-md border border-warning-border bg-warning-soft p-3 text-label-lg text-warning-foreground"
              >
                <ShieldAlert
                  className="mt-0.5 h-4 w-4 shrink-0 text-warning"
                  aria-hidden="true"
                />
                <span>{t('settings.origin.nearQuota', String(originPercent))}</span>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-label-lg text-ink-soft">
                {t('settings.origin.persisted')}:{' '}
                <span className="font-medium text-ink">
                  {origin.persisted === null
                    ? t('settings.origin.persistedUnknown')
                    : origin.persisted
                      ? t('settings.origin.persistedGranted')
                      : t('settings.origin.persistedNotGranted')}
                </span>
              </p>

              {origin.persisted !== true &&
                (origin.persistenceRequestSupported ? (
                  <PanelButton
                    icon={ShieldCheck}
                    label={t('settings.origin.persistAction')}
                    onClick={() => { void handleRequestPersistence() }}
                    disabled={requestingPersist}
                  />
                ) : (
                  <p role="status" className="text-caption text-ink-faint">
                    {t('settings.origin.persistUnavailable')}
                  </p>
                ))}

            </div>
          </>
        )}
      <p className="mt-4 text-caption text-ink-faint">{t('settings.origin.notBackup')}</p>
      <a
        href="#/export"
        className="mt-2 inline-flex min-h-touch items-center rounded-sm text-label-lg font-medium text-saffron-deep underline-offset-4 hover:underline focus-ring"
      >
        {t('settings.origin.backupLink')}
      </a>
      </section>

      <section
        aria-labelledby="settings-semantic-title"
        className="mb-6 rounded-lg border border-border bg-card p-5"
      >
        <SectionHeading
          icon={Database}
          title={t('settings.semantic.title')}
          headingId="settings-semantic-title"
          description={t('settings.semantic.description')}
        />
        <UsageList
          rows={[
            {
              label: t('settings.semantic.documents'),
              value: String(semantic?.documents ?? 0),
            },
            {
              label: t('settings.semantic.bytes'),
              value: formatBytes(semantic?.bytes ?? 0),
            },
            {
              label: t('settings.semantic.budget'),
              value: formatBytes(semantic?.budgetBytes ?? SEMANTIC_INDEX_MAX_BYTES),
            },
            {
              label: t('settings.semantic.status'),
              value: semantic?.status ?? 'idle',
            },
          ]}
        />
        <PanelButton icon={RefreshCw} label={t('settings.semantic.rebuild')} onClick={handleRebuild} />
        <p className="mt-2 text-caption text-ink-faint">{t('settings.semantic.rebuildHint')}</p>
      </section>

      <section
        aria-labelledby="settings-model-title"
        className="rounded-lg border border-border bg-card p-5"
      >
        <SectionHeading
          icon={HardDrive}
          title={t('settings.model.title')}
          headingId="settings-model-title"
          description={t('settings.model.description')}
        />
        <UsageList
          rows={[
            {
              label: t('settings.model.entries'),
              value: String(modelUsage?.entries ?? 0),
            },
            {
              label: t('settings.model.bytes'),
              value: formatBytes(modelUsage?.bytes ?? 0),
            },
            {
              label: t('settings.model.budget'),
              value: formatBytes(modelUsage?.budgetBytes ?? 0),
            },
          ]}
        />
        <PanelButton
          icon={Trash2}
          label={t('settings.model.clear')}
          onClick={() => { void handleClearModelCache() }}
        />
        <p className="mt-2 text-caption text-ink-faint">{t('settings.model.clearHint')}</p>
      </section>
    </div>
  )
}
