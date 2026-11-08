'use client'

/**
 * Synthesis Inbox panel (#1057).
 *
 * Shows what a model proposed for the note being edited and lets a person
 * accept or reject each item. Accepting routes through the store's entity and
 * claim actions, so the result is a normal, undoable library edit; nothing is
 * written while a proposal is pending (ADR 054).
 */
import { useCallback, useMemo } from 'react'
import { Inbox, Sparkles, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useStudioStore } from '@/lib/studio/store'
import { translate } from '@/lib/i18n/messages/synthesis'
import { PROVIDER_LABELS } from '@/lib/ai'
import type { SynthesisProposal } from '@/lib/synthesis/types'
import type { Entity } from '@/lib/studio/types'
import { useSynthesisExtraction } from './use-synthesis-extraction'

/** Percent formatter for a proposal's confidence. */
const CONFIDENCE_FORMAT = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
})

/** Text a proposal is named by, in the list and in accessible labels. */
const proposalName = (proposal: SynthesisProposal): string =>
  proposal.kind === 'entity' ? proposal.name : proposal.statement

/** One proposal row with its evidence and review actions. */
const ProposalRow = ({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: SynthesisProposal
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) => {
  const name = proposalName(proposal)
  const pending = proposal.status === 'pending'
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-saffron-deep">
          {proposal.kind === 'entity'
            ? translate('synthesis.kindEntity')
            : translate('synthesis.kindClaim')}
        </span>
        <p className="flex-1 font-serif text-body leading-relaxed text-ink">&ldquo;{name}&rdquo;</p>
        <span className="font-mono text-caption text-ink-mute">
          {CONFIDENCE_FORMAT.format(proposal.confidence)}
        </span>
      </div>

      {proposal.evidence === '' ? (
        <p className="mt-1.5 text-label italic text-ink-faint">{translate('synthesis.noEvidence')}</p>
      ) : (
        <p className="mt-1.5 border-l-2 border-saffron/40 pl-2 text-label italic leading-relaxed text-ink-mute">
          <span className="font-medium not-italic uppercase tracking-wide">
            {translate('synthesis.evidence')}:{' '}
          </span>
          {proposal.evidence}
        </p>
      )}

      {proposal.duplicateOf !== null && (
        <p className="mt-1.5 text-label text-saffron-deep">{translate('synthesis.duplicate')}</p>
      )}

      {pending ? (
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => { onAccept(proposal.id) }}
            aria-label={translate('synthesis.acceptLabel', name)}
            className="min-h-touch rounded-md bg-saffron px-3 py-1 text-label-lg font-medium text-saffron-foreground transition-colors hover:opacity-90 focus-ring"
          >
            {translate('synthesis.accept')}
          </button>
          <button
            type="button"
            onClick={() => { onReject(proposal.id) }}
            aria-label={translate('synthesis.rejectLabel', name)}
            className="min-h-touch rounded-md border border-border px-3 py-1 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            {translate('synthesis.reject')}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-label font-medium text-ink-faint">
          {proposal.status === 'accepted'
            ? translate('synthesis.statusAccepted')
            : translate('synthesis.statusRejected')}
        </p>
      )}
    </li>
  )
}

/** Review inbox for the note currently open in the editor. */
export const SynthesisInboxPanel = ({ note }: { note: Entity | null }) => {
  const proposals = useStudioStore((state) => state.proposals)
  const entities = useStudioStore((state) => state.entities)
  const addProposals = useStudioStore((state) => state.addProposals)
  const acceptProposal = useStudioStore((state) => state.acceptProposal)
  const rejectProposal = useStudioStore((state) => state.rejectProposal)

  const { running, failure, provider, model, sendsOffDevice, start, stop } =
    useSynthesisExtraction({ note, entities, onProposals: addProposals })

  const noteProposals = useMemo(
    () =>
      note === null
        ? []
        : // `?? []` keeps a host that supplies a partial state (a mocked store,
          // or an envelope hydrated before the inbox existed) from crashing the
          // editor; the persisted envelope always defaults this to a list.
          (proposals ?? []).filter((proposal) => proposal.noteId === note.id),
    [proposals, note],
  )
  const pendingCount = noteProposals.filter((proposal) => proposal.status === 'pending').length

  const handleAccept = useCallback(
    (id: string) => {
      acceptProposal(id)
      toast.success(translate('synthesis.acceptedToast'))
    },
    [acceptProposal],
  )

  const handleReject = useCallback(
    (id: string) => {
      rejectProposal(id)
      toast.success(translate('synthesis.rejectedToast'))
    },
    [rejectProposal],
  )

  const handleExtract = useCallback(() => {
    void start()
  }, [start])

  const canExtract = note !== null && !running

  return (
    <section
      aria-label={translate('synthesis.title')}
      className="mt-6 rounded-lg border border-border bg-surface-sunken/40 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-saffron" aria-hidden="true" />
          <h3 className="font-serif text-body-lg font-semibold text-ink">
            {translate('synthesis.title')}
          </h3>
          <span className="rounded-full bg-muted px-2 py-0 text-caption font-semibold text-ink-mute">
            {CONFIDENCE_FORMAT.format(pendingCount)} {translate('synthesis.count')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="flex min-h-touch items-center gap-1 rounded-md border border-border px-2.5 py-1 text-label font-medium text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              {translate('synthesis.stop')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExtract}
              disabled={!canExtract}
              className="flex min-h-touch items-center gap-1 rounded-md border border-saffron/50 px-2.5 py-1 text-label font-medium text-saffron-deep transition-colors hover:bg-saffron-soft disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {translate('synthesis.extract')}
            </button>
          )}
        </div>
      </div>

      <p className="text-label-lg leading-relaxed text-ink-mute">
        {translate('synthesis.description')}
      </p>

      {provider !== null && (
        <p className="mt-1.5 text-caption text-ink-faint">
          <span className="font-medium uppercase tracking-wide">
            {translate('synthesis.provider')}:
          </span>{' '}
          {PROVIDER_LABELS[provider]} ·{' '}
          <span className="font-medium uppercase tracking-wide">{translate('synthesis.model')}:</span>{' '}
          {model}
        </p>
      )}

      <p className="mt-1 text-label leading-relaxed text-ink-faint">
        {sendsOffDevice
          ? translate('synthesis.leavesDevice')
          : translate('synthesis.localOnly')}
      </p>

      {failure !== null && (
        <p
          role="status"
          className="mt-3 rounded-md border border-destructive/40 bg-background p-2 text-label-lg text-destructive"
        >
          {failure === 'rate-limited'
            ? translate('synthesis.rateLimited')
            : failure === 'need-provider'
              ? translate('synthesis.needProvider')
              : translate(`synthesis.failure.${failure}`)}
        </p>
      )}

      {noteProposals.length === 0 ? (
        <p className="mt-3 text-label-lg leading-relaxed text-ink-mute">
          {translate('synthesis.empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {noteProposals.map((proposal) => (
            <ProposalRow
              key={proposal.id}
              proposal={proposal}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
