/**
 * Synthesis Inbox messages (#1057).
 *
 * Scope module for `synthesis-inbox-panel.tsx`, following the per-view i18n
 * convention in `src/lib/i18n/t.ts`.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Panel heading. */
  'synthesis.title': 'Synthesis inbox',
  /** What the panel does and the promise it keeps. */
  'synthesis.description':
    'Proposals the model extracted from this note. Nothing is added to your library until you accept it.',
  /** Count badge prefix. */
  'synthesis.count': 'proposals',
  /** Action that runs an extraction. */
  'synthesis.extract': 'Extract',
  /** Action label while an extraction runs. */
  'synthesis.extracting': 'Extracting…',
  /** Action that aborts a running extraction. */
  'synthesis.stop': 'Stop',
  /** Empty state with no extraction run yet. */
  'synthesis.empty': 'No proposals yet. Extract to review what the model finds in this note.',
  /** Label before the provider name. */
  'synthesis.provider': 'Provider',
  /** Label before the model name. */
  'synthesis.model': 'Model',
  /** Privacy note for providers that keep data on the device. */
  'synthesis.localOnly': 'This model runs on your device. The note text is not sent anywhere.',
  /** Privacy note for remote providers. */
  'synthesis.leavesDevice':
    'This provider is remote: the note text leaves your device for the provider to answer.',
  /** Badge on an entity proposal. */
  'synthesis.kindEntity': 'Entity',
  /** Badge on a claim proposal. */
  'synthesis.kindClaim': 'Claim',
  /** Label before the quoted evidence span. */
  'synthesis.evidence': 'Evidence',
  /** Shown when no verbatim span could be quoted. */
  'synthesis.noEvidence': 'No verbatim evidence in the note',
  /** Label before the confidence value. */
  'synthesis.confidence': 'Confidence',
  /** Hint that a proposal restates an existing entity. */
  'synthesis.duplicate': 'Looks like an existing entity',
  /** Action that creates the entity or claim. */
  'synthesis.accept': 'Accept',
  /** Accessible label for accept, naming the item. */
  'synthesis.acceptLabel': (name: string) => `Accept proposal: ${name}`,
  /** Action that discards a proposal. */
  'synthesis.reject': 'Reject',
  /** Accessible label for reject, naming the item. */
  'synthesis.rejectLabel': (name: string) => `Reject proposal: ${name}`,
  /** Status shown on an accepted proposal. */
  'synthesis.statusAccepted': 'Accepted',
  /** Status shown on a rejected proposal. */
  'synthesis.statusRejected': 'Rejected',
  /** Toast after an accept. */
  'synthesis.acceptedToast': 'Added to your library. Undo reverses it.',
  /** Toast after a reject. */
  'synthesis.rejectedToast': 'Proposal rejected',
  /** Shown when no provider is configured yet. */
  'synthesis.needProvider': 'Configure an AI provider in the AI workspace first.',
  /** Failure: the note has no text to extract from. */
  'synthesis.failure.empty-input': 'This note has no text to extract from.',
  /** Failure: the provider call failed. */
  'synthesis.failure.provider': 'The provider did not answer. Check the settings and try again.',
  /** Failure: the response was larger than the accepted cap. */
  'synthesis.failure.too-large': 'The model returned far more than expected. Try a shorter note.',
  /** Failure: the response was not JSON. */
  'synthesis.failure.not-json': 'The model did not return JSON. Try again or switch models.',
  /** Failure: the response did not match the expected schema. */
  'synthesis.failure.schema': 'The model returned an unexpected shape and was ignored.',
  /** Failure: the response proposed more items than allowed. */
  'synthesis.failure.too-many': 'The model proposed too many items at once. Try a shorter note.',
  /** Failure: the response contained nothing usable. */
  'synthesis.failure.empty': 'The model found nothing it could support with the note.',
  /** Failure: rate limit reached. */
  'synthesis.rateLimited': 'That is a lot of extractions in a minute. Wait a moment and try again.',
} as const

/** Typed `translate` helper bound to the synthesis message scope. */
export const translate = makeT(messages)
