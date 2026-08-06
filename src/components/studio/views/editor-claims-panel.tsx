import { useState } from 'react'
import { Plus, ExternalLink, ShieldCheck, CheckCircle2, AlertTriangle, Circle, Save, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Claim, VerificationStatus } from '@/lib/studio/types'

/** Colored badge indicating a claim&apos;s verification status. */
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified')
    return (
      <span className="flex items-center gap-1 text-caption font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </span>
    )
  if (status === 'disputed')
    return (
      <span className="flex items-center gap-1 text-caption font-medium text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Disputed
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-caption font-medium text-ink-faint">
      <Circle className="h-3 w-3" />
      Unverified
    </span>
  )
}

/** Panel for viewing, creating, editing, and deleting claims on an entity. */
export function ClaimsPanel({
  claims,
  editingEntityId,
  addClaim,
  updateClaim,
  deleteClaim,
}: {
  claims: Claim[]
  editingEntityId: string
  addClaim: (claim: Omit<Claim, 'id'>) => void
  updateClaim: (id: string, updates: Partial<Omit<Claim, 'id' | 'entityId'>>) => void
  deleteClaim: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [statement, setStatement] = useState('')
  const [verification, setVerification] = useState<VerificationStatus>('unverified')
  const [confidence, setConfidence] = useState(50)
  const [source, setSource] = useState('')

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
      toast.error('Claim statement is required')
      return
    }
    if (editingId) {
      updateClaim(editingId, {
        statement: trimmed,
        verification,
        confidence: confidence / 100,
        source: source.trim() || undefined,
      })
      toast.success('Claim updated')
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
    toast.success('Claim deleted')
  }

  return (
    <section
      aria-label="Claims"
      className="mt-6 rounded-lg border border-border bg-surface-sunken/40 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-saffron" />
          <h3 className="font-serif text-[15px] font-semibold text-ink">Claims</h3>
          <span className="rounded-full bg-muted px-2 py-0 text-caption font-semibold text-ink-mute">
            {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
          </span>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true) }}
            className="flex min-h-[44px] items-center gap-1 rounded-md border border-dashed border-saffron/50 px-2.5 py-1 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
          >
            <Plus className="h-3 w-3" />
            Add claim
          </button>
        )}
      </div>

      {claims.length === 0 && !showForm && (
        <p className="text-[12px] leading-relaxed text-ink-mute">
          No claims recorded for this entity yet. Capture a factual statement you can later verify, dispute, or cite.
        </p>
      )}

      <ul className="space-y-3">
        {claims.map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-border bg-background p-3 shadow-soft"
            style={{ borderLeft: '3px solid var(--saffron)' }}
          >
            <p className="font-serif text-[14px] italic leading-relaxed text-ink">
              &ldquo;{c.statement}&rdquo;
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <VerificationBadge status={c.verification} />
              <div className="flex items-center gap-1.5">
                <span className="text-caption font-medium uppercase tracking-wide text-ink-faint">
                  Confidence
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-saffron"
                    style={{ width: `${Math.round(c.confidence * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-caption text-ink-mute">
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
              {c.source && (
                <span className="flex items-center gap-1 text-caption text-ink-faint">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {c.source}
                </span>
              )}
            </div>

            {c.evidence && (
              <p className="mt-1.5 text-label italic leading-relaxed text-ink-mute">
                {c.evidence}
              </p>
            )}

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { startEdit(c) }}
                className="flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1 text-label font-medium text-ink-faint transition-colors hover:bg-muted hover:text-ink focus-ring"
                aria-label="Edit claim"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => { handleDelete(c.id) }}
                className="flex min-h-[44px] items-center gap-1 rounded-md px-2 py-1 text-label font-medium text-ink-faint transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 focus-ring"
                aria-label="Delete claim"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="mt-3 rounded-md border border-saffron/40 bg-background p-3">
          <label htmlFor="claim-statement" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
            {editingId ? 'Edit statement' : 'Statement'}
          </label>
          <textarea
            id="claim-statement"
            value={statement}
            onChange={(e) => { setStatement(e.target.value) }}
            placeholder="State a factual claim about this entity…"
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="claim-verification" className="mb-1 block text-label font-semibold uppercase tracking-wide text-ink-faint">
                Verification
              </label>
              <select
                id="claim-verification"
                value={verification}
                onChange={(e) => { setVerification(e.target.value as VerificationStatus) }}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-ink focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
              >
                <option value="unverified">Unverified</option>
                <option value="verified">Verified</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
            <div>
              <label htmlFor="claim-confidence" className="mb-1 flex items-center justify-between text-label font-semibold uppercase tracking-wide text-ink-faint">
                <span>Confidence</span>
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
              Source (optional)
            </label>
            <input
              id="claim-source"
              value={source}
              onChange={(e) => { setSource(e.target.value) }}
              placeholder="Where did this claim come from? (URL, book, person…)"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!statement.trim()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 press-scale focus-ring"
            >
              <Save className="h-3.5 w-3.5" />
              {editingId ? 'Update claim' : 'Save claim'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
