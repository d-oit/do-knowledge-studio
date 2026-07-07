'use client'

import { useStudioStore } from '@/lib/studio/store'
import {
  ENTITY_TYPE_META,
  type Entity,
  type EntityType,
  type VerificationStatus,
} from '@/lib/studio/types'
import { useState, useMemo } from 'react'
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote as QuoteIcon,
  Code,
  Link2,
  Undo2,
  Redo2,
  Sparkles,
  Save,
  X,
  Plus,
  ChevronDown,
  ExternalLink,
  Tag,
  FileText,
  Lightbulb,
  User,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Circle,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const TYPE_ICONS: Record<EntityType, typeof FileText> = {
  note: FileText,
  concept: Lightbulb,
  person: User,
  project: FolderKanban,
}

export function EditorView() {
  const { entities, editingEntityId, saveEntity, startNew, claims, addClaim } = useStudioStore()

  const editing = useMemo(
    () => entities.find((e) => e.id === editingEntityId) || null,
    [entities, editingEntityId],
  )

  const entityClaims = useMemo(
    () => (editingEntityId ? claims.filter((c) => c.entityId === editingEntityId) : []),
    [claims, editingEntityId],
  )

  const [name, setName] = useState(editing?.name || '')
  const [type, setType] = useState<EntityType>(editing?.type || 'note')
  const [content, setContent] = useState(editing?.content || '')
  const [description, setDescription] = useState(editing?.description || '')
  const [sourceUrl, setSourceUrl] = useState(editing?.sourceUrl || '')
  const [tags, setTags] = useState<string[]>(editing?.tags || [])
  const [newTag, setNewTag] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length
  const charCount = content.length
  const isDirty = editing
    ? editing.name !== name ||
      editing.content !== content ||
      editing.type !== type ||
      editing.description !== description
    : name.trim() !== '' || content.trim() !== ''

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Entity name is required')
      return
    }
    const entity: Entity = {
      id: editing?.id || `e-${Date.now().toString(36)}`,
      name: name.trim(),
      type,
      description: description.trim() || content.slice(0, 200).replace(/[#*]/g, '').trim(),
      content,
      sourceUrl: sourceUrl.trim() || undefined,
      tags,
      createdAt: editing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      links: editing?.links || [],
    }
    saveEntity(entity)
    toast.success(editing ? 'Entity updated' : 'Entity saved to library')
  }

  const handleCancel = () => {
    startNew()
    setName('')
    setType('note')
    setContent('')
    setDescription('')
    setSourceUrl('')
    setTags([])
  }

  const addTag = () => {
    const t = newTag.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setNewTag('')
  }

  const meta = ENTITY_TYPE_META[type]
  const TypeIcon = TYPE_ICONS[type]

  return (
    <div className="mx-auto max-w-3xl px-6 py-6 lg:px-10 lg:py-8">
      {/* Entity meta header */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', meta.bg, meta.text)}>
            <TypeIcon className="h-3 w-3" />
            {meta.label}
          </span>
          {editing && (
            <span className="text-[11px] text-ink-faint">
              Edited {new Date(editing.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entity name…"
          className="w-full bg-transparent font-serif text-3xl font-semibold leading-tight tracking-tight text-ink placeholder:text-ink-faint/60 focus:outline-none"
          autoFocus={!editing}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description (optional)…"
          rows={2}
          className="mt-2 w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink-mute placeholder:text-ink-faint/60 focus:outline-none"
        />
      </div>

      {/* Type selector + tags */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-saffron/40 focus-ring"
          >
            <TypeIcon className={cn('h-3.5 w-3.5', meta.text)} />
            Type: {meta.label}
            <ChevronDown className="h-3 w-3" />
          </button>
          {showTypeMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-border bg-popover p-1 shadow-lg">
              {(Object.keys(ENTITY_TYPE_META) as EntityType[]).map((t) => {
                const m = ENTITY_TYPE_META[t]
                const Icon = TYPE_ICONS[t]
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setType(t)
                      setShowTypeMenu(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-[12px] transition-colors hover:bg-muted',
                      t === type ? 'font-semibold text-ink' : 'text-ink-soft',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', m.text)} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {tags.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft"
          >
            #{t}
            <button
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="text-ink-faint hover:text-red-500"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5">
          <Tag className="h-2.5 w-2.5 text-ink-faint" />
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="add tag"
            className="w-16 bg-transparent text-[11px] text-ink-soft placeholder:text-ink-faint focus:outline-none"
          />
          {newTag && (
            <button onClick={addTag} className="text-saffron hover:text-saffron-deep">
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-6 mb-3 border-y border-border bg-background/90 px-6 py-2 backdrop-blur-sm lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton icon={Bold} label="Bold" />
          <ToolbarButton icon={Italic} label="Italic" />
          <Divider />
          <ToolbarButton icon={Heading1} label="Heading 1" />
          <ToolbarButton icon={Heading2} label="Heading 2" />
          <Divider />
          <ToolbarButton icon={List} label="Bullet list" />
          <ToolbarButton icon={ListOrdered} label="Numbered list" />
          <ToolbarButton icon={QuoteIcon} label="Quote" />
          <ToolbarButton icon={Code} label="Code" />
          <Divider />
          <ToolbarButton icon={Link2} label="Insert link" />
          <ToolbarButton icon={Undo2} label="Undo" />
          <ToolbarButton icon={Redo2} label="Redo" />
          <div className="flex-1" />
          <button
            onClick={() => toast.info('AI extraction would scan the body for entities.')}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
          >
            <Sparkles className="h-3 w-3" />
            AI Extract
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted focus-ring',
              showAdvanced ? 'text-ink' : 'text-ink-mute',
            )}
          >
            Advanced
            <ChevronDown className={cn('h-3 w-3 transition-transform', showAdvanced && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* Advanced */}
      {showAdvanced && (
        <div className="mb-4 space-y-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              <ExternalLink className="h-3 w-3" />
              Source URL
            </label>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-1 focus:ring-saffron/30"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing. Use markdown for headings, lists, and emphasis…"
          className="min-h-[420px] w-full resize-none bg-transparent font-serif text-[16px] leading-[1.75] text-ink placeholder:text-ink-faint/60 focus:outline-none"
          style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
        />
      </div>

      {/* Claims panel — only visible when editing an existing entity. */}
      {editing && (
        <ClaimsPanel
          claims={entityClaims}
          editingEntityId={editing.id}
          addClaim={addClaim}
        />
      )}

      {/* Footer bar */}
      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center justify-between border-t border-border bg-background/90 px-6 py-3 backdrop-blur-sm lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3 text-[11px] text-ink-faint">
          <span>{wordCount} words</span>
          <span>·</span>
          <span>{charCount} chars</span>
          {isDirty && (
            <>
              <span>·</span>
              <span className="text-saffron">Unsaved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={handleCancel}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
            >
              Cancel edit
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
          >
            <Save className="h-3.5 w-3.5" />
            {editing ? 'Update entity' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({ icon: Icon, label }: { icon: typeof Bold; label: string }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={() => toast.info(`${label} — would apply formatting`)}
      className="rounded p-1.5 text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />
}

// Verification status icons (used in claims UI elsewhere)
export function VerificationBadge({ status }: { status: 'verified' | 'unverified' | 'disputed' }) {
  if (status === 'verified')
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </span>
    )
  if (status === 'disputed')
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Disputed
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-ink-faint">
      <Circle className="h-3 w-3" />
      Unverified
    </span>
  )
}

/**
 * Claims panel shown inside the editor when an existing entity is being
 * edited. Renders the entity's existing claims as quote-styled cards with
 * a saffron left border, plus an inline "Add claim" form (dashed button
 * that expands into a textarea + verification select + confidence range
 * + source input).
 */
function ClaimsPanel({
  claims,
  editingEntityId,
  addClaim,
}: {
  claims: ReturnType<typeof useStudioStore.getState>['claims']
  editingEntityId: string
  addClaim: ReturnType<typeof useStudioStore.getState>['addClaim']
}) {
  const [showForm, setShowForm] = useState(false)
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
  }

  const handleSave = () => {
    const trimmed = statement.trim()
    if (!trimmed) {
      toast.error('Claim statement is required')
      return
    }
    addClaim({
      entityId: editingEntityId,
      statement: trimmed,
      verification,
      confidence: confidence / 100,
      source: source.trim() || undefined,
    })
    toast.success('Claim added')
    resetForm()
  }

  return (
    <section
      aria-label="Claims"
      className="mt-6 rounded-lg border border-border bg-surface-sunken/40 p-4"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-saffron" />
          <h3 className="font-serif text-[15px] font-semibold text-ink">Claims</h3>
          <span className="rounded-full bg-muted px-2 py-0 text-[10px] font-semibold text-ink-mute">
            {claims.length} {claims.length === 1 ? 'claim' : 'claims'}
          </span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-md border border-dashed border-saffron/50 px-2.5 py-1 text-[11px] font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
          >
            <Plus className="h-3 w-3" />
            Add claim
          </button>
        )}
      </div>

      {/* Existing claims */}
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
              “{c.statement}”
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <VerificationBadge status={c.verification} />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                  Confidence
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-saffron"
                    style={{ width: `${Math.round(c.confidence * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-ink-mute">
                  {Math.round(c.confidence * 100)}%
                </span>
              </div>
              {c.source && (
                <span className="flex items-center gap-1 text-[10px] text-ink-faint">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {c.source}
                </span>
              )}
            </div>

            {c.evidence && (
              <p className="mt-1.5 text-[11px] italic leading-relaxed text-ink-mute">
                {c.evidence}
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* Inline add-claim form */}
      {showForm && (
        <div className="mt-3 rounded-md border border-saffron/40 bg-background p-3">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Statement
          </label>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="State a factual claim about this entity…"
            rows={3}
            autoFocus
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
          />

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Verification
              </label>
              <select
                value={verification}
                onChange={(e) => setVerification(e.target.value as VerificationStatus)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-ink focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
              >
                <option value="unverified">Unverified</option>
                <option value="verified">Verified</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                <span>Confidence</span>
                <span className="font-mono text-[10px] text-ink-mute">{confidence}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="h-7 w-full accent-[var(--saffron)]"
                aria-label="Confidence"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Source (optional)
            </label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Where did this claim come from? (URL, book, person…)"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-[12px] text-ink placeholder:text-ink-faint focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/30"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!statement.trim()}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
            >
              <Save className="h-3.5 w-3.5" />
              Save claim
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
