import { useCallback, useMemo, useState } from 'react'
import { Plus, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle, Circle, Save, Pencil, Trash2, Wand2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Claim, VerificationStatus } from '@/lib/studio/types'
import { useStudioStore } from '@/lib/studio/store'
import { Overlay } from '@/components/studio/ui/shared-primitives'
import { extractClaimsFromText, hasExtractableClaims, type ParsedClaimDraft } from '@/lib/studio/claim-parser'
import { translate } from '@/lib/i18n/messages/claims'

/** Colored badge indicating a claim&apos;s verification status. */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified')
    return (
      <span className="flex items-center gap-1 text-caption font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        {translate('claims.verified')}
      </span>
    )
  if (status === 'disputed')
    return (
      <span className="flex items-center gap-1 text-caption font-medium text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {translate('claims.disputed')}
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-caption font-medium text-ink-faint">
      <Circle className="h-3 w-3" />
      {translate('claims.unverified')}
    </span>
  )
}

/** Confidence (0..1) assigned to claims created via extraction. */
const DEFAULT_CONFIDENCE = 0.5

/** Joins statement and source into a stable duplicate-detection key. */
const DRAFT_KEY_SEPARATOR = '\u0000'

/** A single claim row with verification, confidence, and edit/delete actions. */
const ClaimRow = ({
  claim,
  onEdit,
  onDelete,
}: {
  claim: Claim
  onEdit: (claim: Claim) => void
  onDelete: (id: string) => void
}) => (
  <li
    key={claim.id}
    className="rounded-md border border-border bg-background p-3 shadow-soft"
    style={{ borderLeft: '3px solid var(--saffron)' }}
  >
    <p className="font-serif text-[14px] italic leading-relaxed text-ink">
      &ldquo;{claim.statement}&rdquo;
    </p>

    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <VerificationBadge status={claim.verification} />
      <div className="flex items-center gap-1.5">
        <span className="text-caption font-medium uppercase tracking-wide text-ink-faint">
          {translate('claims.confidenceLabel')}
        </span>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-saffron"
            style={{ width: `${Math.round(claim.confidence * 100)}%` }}
          />
        </div>
        <span className="font-mono text-caption text-ink-mute">
          {Math.round(claim.confidence * 100)}%
        </span>
      </div>
      {claim.source && (
        <span className="flex items-center gap-1 text-caption text-ink-faint">
          <ExternalLink className="h-2.5 w-2.5" />
          {claim.source}
        </span>
      )}
    </div>

    {claim.evidence && (
      <p className="mt-1.5 text-label italic leading-relaxed text-ink-mute">
        {claim.evidence}
      </p>
    )}

    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={() => { onEdit(claim) }}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1 text-label font-medium text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
        aria-label={translate('claims.editLabel')}
      >
        <Pencil className="h-3 w-3" />
        {translate('claims.edit')}
      </button>
      <button
        type="button"
        onClick={() => { onDelete(claim.id) }}
        className="flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1 text-label font-medium text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 focus-ring"
        aria-label={translate('claims.deleteLabel')}
      >
        <Trash2 className="h-3 w-3" />
        {translate('claims.delete')}
      </button>
    </div>
  </li>
)

/** Panel for viewing, creating, editing, and deleting claims on an entity. */
export const ClaimsPanel = ({
  claims,
  editingEntityId,
  entityContent,
  addClaim,
  updateClaim,
  deleteClaim,
}: {
  claims: Claim[]
  editingEntityId: string
  /** The editor's CURRENT draft content — extraction must see unsaved edits,
   * not the last persisted entity record. Falls back to the persisted entity
   * content when omitted (standalone/test usage). */
  entityContent?: string
  addClaim: (claim: Omit<Claim, 'id'>) => void
  updateClaim: (id: string, updates: Partial<Omit<Claim, 'id' | 'entityId'>>) => void
  deleteClaim: (id: string) => void
}) => {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statement, setStatement] = useState('')
  const [verification, setVerification] = useState<VerificationStatus>('unverified')
  const [confidence, setConfidence] = useState(50)
  const [source, setSource] = useState('')
  const [extractDrafts, setExtractDrafts] = useState<ParsedClaimDraft[] | null>(null)

  const entities = useStudioStore((state) => state.entities)

  const resetForm = () => {
    setStatement('')
    setVerification('unverified')
    setConfidence(50)
    setSource('')
    setShowForm(false)
    setEditingId(null)
  }

  const startEdit = (claim: Claim) => {
    setEditingId(claim.id)
    setStatement(claim.statement)
    setVerification(claim.verification)
    setConfidence(Math.round(claim.confidence * 100))
    setSource(claim.source ?? '')
    setShowForm(true)
  }

  const handleSave = () => {
    const trimmed = statement.trim()
    if (!trimmed) {
      toast.error(translate('claims.statementRequired'))
      return
    }
    if (editingId) {
      updateClaim(editingId, {
        statement: trimmed,
        verification,
        confidence: confidence / 100,
        source: source.trim() || undefined,
      })
      toast.success(translate('claims.updated'))
    } else {
      addClaim({
        entityId: editingEntityId,
        statement: trimmed,
        verification,
        confidence: confidence / 100,
        source: source.trim() || undefined,
      })
    }
    resetForm()
  }

  const handleDelete = (id: string) => {
    deleteClaim(id)
    toast.success(translate('claims.deleted'))
  }
  // Prefer the live draft passed by the editor; fall back to the persisted
  // entity record when the caller does not supply draft content.
  const persistedContent = useMemo(
    () => entities.find((entity) => entity.id === editingEntityId)?.content ?? '',
    [entities, editingEntityId],
  )
  const extractionSource = entityContent ?? persistedContent

  const canExtract = useMemo(() => hasExtractableClaims(extractionSource), [extractionSource])

  const openExtractDialog = useCallback(() => {
    const drafts = extractClaimsFromText(extractionSource)
    if (drafts.length === 0) {
      toast.info(translate('claims.noneFound'))
      return
    }
    setExtractDrafts(drafts)
  }, [extractionSource])

  const closeExtractDialog = useCallback(() => {
    setExtractDrafts(null)
  }, [])

  const handleExtractConfirm = useCallback(() => {
    if (!extractDrafts) return
    const existing = new Set(
      claims.map((claim) => `${claim.statement}${DRAFT_KEY_SEPARATOR}${claim.source ?? ''}`),
    )
    const toAdd = extractDrafts.filter(
      (draft) => !existing.has(`${draft.statement}${DRAFT_KEY_SEPARATOR}${draft.source ?? ''}`),
    )
    const skipped = extractDrafts.length - toAdd.length
    for (const draft of toAdd) {
      addClaim({
        entityId: editingEntityId,
        statement: draft.statement,
        source: draft.source,
        confidence: DEFAULT_CONFIDENCE,
        verification: 'unverified',
      })
    }
    setExtractDrafts(null)
    if (toAdd.length > 0) toast.success(translate('claims.added', String(toAdd.length)))
    if (skipped > 0) toast.info(translate('claims.skipped', String(skipped)))
  }, [claims, extractDrafts, editingEntityId, addClaim])

  return (
    <section
      aria-label={translate('claims.title')}
      className="mt-6 rounded-lg border border-border bg-surface-sunken/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-saffron" />
          <h3 className="font-serif text-[15px] font-semibold text-ink">{translate('claims.title')}</h3>
          <span className="rounded-full bg-muted px-2 py-0 text-caption font-semibold text-ink-mute">
            {translate('claims.count', String(claims.length))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canExtract && (
            <button
              type="button"
              onClick={openExtractDialog}
              className="flex min-h-[44px] items-center gap-1 rounded-md border border-border px-2.5 py-1 text-label font-medium text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
            >
              <Wand2 className="h-3.5 w-3.5 text-saffron" />
              {translate('claims.extract')}
            </button>
          )}
          {!showForm && (
            <button
              type="button"
              onClick={() => { setShowForm(true) }}
              className="flex min-h-[44px] items-center gap-1 rounded-md border border-dashed border-saffron/50 px-2.5 py-1 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
            >
              <Plus className="h-3 w-3" />
              {translate('claims.add')}
            </button>
          )}
        </div>
      </div>

      {claims.length === 0 && !showForm && (
        <p className="text-[12px] leading-relaxed text-ink-mute">
          {translate('claims.empty')}
        </p>
      )}

      <ul className="space-y-3">
        {claims.map((c) => (
          <ClaimRow key={c.id} claim={c} onEdit={startEdit} onDelete={handleDelete} />
        ))}
      </ul>

      {showForm && (
        <div className="mt-3 rounded-md border border-saffron/40 bg-background p-3">
          <label htmlFor="claim-statement" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
            {editingId ? translate('claims.editStatementLabel') : translate('claims.statementLabel')}
          </label>
          <textarea
            id="claim-statement"
            value={statement}
            onChange={(e) => { setStatement(e.target.value) }}
            placeholder={translate('claims.statementPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-verification" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
                {translate('claims.verificationLabel')}
              </label>
              <select
                id="claim-verification"
                value={verification}
                onChange={(e) => { setVerification(e.target.value as VerificationStatus) }}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-ink focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
              >
                <option value="unverified">{translate('claims.unverified')}</option>
                <option value="verified">{translate('claims.verified')}</option>
                <option value="disputed">{translate('claims.disputed')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="claim-confidence" className="mb-1 flex items-center justify-between text-label font-semibold uppercase tracking-wide text-ink-faint">
                <span>{translate('claims.confidenceLabel')}</span>
                <span className="font-mono text-caption text-ink-mute">{confidence}%</span>
              </label>
              <input
                id="claim-confidence"
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidence}
                onChange={(e) => { setConfidence(Number(e.target.value)) }}
                className="h-7 w-full accent-[var(--saffron)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              />
            </div>
          </div>

          <div className="mt-3">
            <label htmlFor="claim-source" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
              {translate('claims.sourceOptionalLabel')}
            </label>
            <input
              id="claim-source"
              value={source}
              onChange={(e) => { setSource(e.target.value) }}
              placeholder={translate('claims.sourcePlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring min-h-[44px]"
            >
              {translate('claims.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!statement.trim()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 press-scale focus-ring"
            >
              <Save className="h-3.5 w-3.5" />
              {editingId ? translate('claims.update') : translate('claims.save')}
            </button>
          </div>
        </div>
      )}

      <Overlay
        open={extractDrafts !== null}
        onClose={closeExtractDialog}
        aria-label={translate('claims.extractTitle')}
      >
        <div className="rounded-xl border border-border bg-popover p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-[15px] font-semibold text-ink">
                {translate('claims.extractTitle')}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">
                {translate('claims.extractBody')}
              </p>
            </div>
            <button
              type="button"
              onClick={closeExtractDialog}
              aria-label={translate('claims.close')}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {(extractDrafts ?? []).map((draft) => (
              <li
                key={`${draft.statement}${DRAFT_KEY_SEPARATOR}${draft.source ?? ''}`}
                className="rounded-md border border-border bg-background p-3"
              >
                <p className="font-serif text-[13px] italic leading-relaxed text-ink">
                  &ldquo;{draft.statement}&rdquo;
                </p>
                <p className="mt-1 text-caption text-ink-faint">
                  <span className="font-medium uppercase tracking-wide">
                    {translate('claims.listSource')}:{' '}
                  </span>
                  {draft.source ?? translate('claims.listNoSource')}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeExtractDialog}
              className="min-h-[44px] rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
            >
              {translate('claims.cancel')}
            </button>
            <button
              type="button"
              onClick={handleExtractConfirm}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
            >
              {translate('claims.confirm', String(extractDrafts?.length ?? 0))}
            </button>
          </div>
        </div>
      </Overlay>
    </section>
  )
}
