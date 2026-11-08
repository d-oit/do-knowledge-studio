/**
 * Provider-backed knowledge extraction for the Synthesis Inbox (#1057).
 *
 * The model is asked for one JSON object, and everything it returns is treated
 * as untrusted: the response is size-capped, parsed, schema-checked, trimmed to
 * the configured bounds, and stripped of any evidence span that is not a
 * verbatim quote of the note. What survives becomes a pending proposal — never
 * an entity or a claim.
 */
import { sendChat } from '@/lib/ai'
import type { ChatMessage, ChatResult, ProviderId } from '@/lib/ai'
import type { Entity } from '@/lib/studio/types'
import { findDuplicateEntity } from './dedupe'
import {
  DEFAULT_EXTRACTION_CONFIDENCE,
  FALLBACK_ENTITY_TYPE,
  MAX_EVIDENCE_CHARS,
  MAX_EXTRACTION_INPUT_CHARS,
  MAX_EXTRACTION_RESPONSE_CHARS,
  MAX_PROPOSAL_TEXT_CHARS,
  MAX_PROPOSED_CLAIMS,
  MAX_PROPOSED_ENTITIES,
  MAX_PROVENANCE_CHARS,
  RawExtractionSchema,
} from './schema'
import type {
  ExtractedClaim,
  ExtractedEntity,
  ExtractedKnowledge,
  ExtractionFailure,
  ExtractionRequest,
  SynthesisProposal,
} from './types'

/** Line shelf where a fenced block would start. */
const FENCE_PATTERN = /^```[a-zA-Z]*\s*|\s*```$/g

/** Guidance sent as the system message; the schema is restated in prose. */
export const EXTRACTION_SYSTEM_PROMPT = [
  'You extract structured knowledge from a single note.',
  'Answer with ONE JSON object and nothing else — no prose, no code fence.',
  'Shape:',
  '{"entities":[{"name":string,"type":"note"|"concept"|"person"|"project",',
  '"description":string,"evidence":string}],',
  '"claims":[{"statement":string,"entity":string,"confidence":number,',
  '"evidence":string}]}',
  'Every evidence string MUST be copied verbatim from the note.',
  'Use at most 12 entities and 24 claims. Omit anything the note does not support.',
  'Never invent names, dates or numbers that the note does not contain.',
].join('\n')

/** Trims a value to at most `max` characters. */
const clip = (value: string, max: number): string => (value.length <= max ? value : value.slice(0, max))

/** Collapses a response to its JSON object, dropping prose and code fences. */
const isolateJsonObject = (raw: string): string => {
  const withoutFences = raw.replace(FENCE_PATTERN, '').trim()
  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return withoutFences
  return withoutFences.slice(start, end + 1)
}

/**
 * Keeps an evidence span only when it is quoted from the note.
 *
 * A model that paraphrases its "quote" has produced something a reviewer
 * cannot check, so the span is dropped rather than trusted.
 */
export const verifyEvidenceSpan = (evidence: string | undefined, note: string): string => {
  const trimmed = (evidence ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '')
  if (trimmed === '') return ''
  if (!note.includes(trimmed)) return ''
  return clip(trimmed, MAX_EVIDENCE_CHARS)
}

/** Maps an arbitrary type string onto a known entity type. */
const toEntityType = (type: string | undefined): string => {
  const normalized = (type ?? '').trim().toLowerCase()
  if (normalized === 'note' || normalized === 'person' || normalized === 'project') return normalized
  if (normalized === 'concept') return normalized
  return FALLBACK_ENTITY_TYPE
}

/** Clamps a model-reported confidence into 0..1. */
const toConfidence = (confidence: number | undefined): number => {
  if (confidence === undefined || Number.isNaN(confidence)) return DEFAULT_EXTRACTION_CONFIDENCE
  return Math.min(1, Math.max(0, confidence))
}

/** Notes longer than the cap are trimmed before they leave the device. */
export const clipExtractionInput = (note: string): string => clip(note, MAX_EXTRACTION_INPUT_CHARS)

/** Builds the two messages an extraction request sends. */
export const buildExtractionMessages = (note: string): ChatMessage[] => [
  { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
  { role: 'user', content: clipExtractionInput(note) },
]

/** Parses a note into entity and claim drafts, or explains why it cannot. */
export const parseExtractionResponse = (
  raw: string,
  note: string,
): { ok: true; knowledge: ExtractedKnowledge } | { ok: false; reason: ExtractionFailure } => {
  if (raw.length > MAX_EXTRACTION_RESPONSE_CHARS) return { ok: false, reason: 'too-large' }
  let parsed: unknown
  try {
    parsed = JSON.parse(isolateJsonObject(raw))
  } catch (error) {
    // A truncated or prose-wrapped answer is an expected model failure; the
    // caller shows a retry message, so the parse error itself is not surfaced.
    void error
    return { ok: false, reason: 'not-json' }
  }
  const result = RawExtractionSchema.safeParse(parsed)
  if (!result.success) return { ok: false, reason: 'schema' }
  if (result.data.entities.length > MAX_PROPOSED_ENTITIES) return { ok: false, reason: 'too-many' }
  if (result.data.claims.length > MAX_PROPOSED_CLAIMS) return { ok: false, reason: 'too-many' }

  const entities: ExtractedEntity[] = []
  for (const candidate of result.data.entities) {
    const name = candidate.name.trim()
    if (name === '') continue
    entities.push({
      name: clip(name, MAX_PROPOSAL_TEXT_CHARS),
      entityType: toEntityType(candidate.type),
      description: clip((candidate.description ?? '').trim(), MAX_PROPOSAL_TEXT_CHARS),
      evidence: verifyEvidenceSpan(candidate.evidence, note),
    })
  }

  const claims: ExtractedClaim[] = []
  for (const candidate of result.data.claims) {
    const statement = candidate.statement.trim()
    if (statement === '') continue
    const entityName = (candidate.entity ?? '').trim()
    claims.push({
      statement: clip(statement, MAX_PROPOSAL_TEXT_CHARS),
      entityName: entityName === '' ? null : clip(entityName, MAX_PROPOSAL_TEXT_CHARS),
      confidence: toConfidence(candidate.confidence),
      evidence: verifyEvidenceSpan(candidate.evidence, note),
    })
  }

  if (entities.length === 0 && claims.length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, knowledge: { entities, claims } }
}

/** Provenance string written to accepted claims: `ai:<model>`. */
export const toProvenance = (model: string): string =>
  clip(`ai:${model}`, MAX_PROVENANCE_CHARS)

/** Everything a proposal needs beyond the parsed drafts. */
export interface ProposalsContext {
  note: Entity
  provider: string
  model: string
  /** Corpus snapshot used to flag duplicates. */
  entities: readonly Entity[]
  /** Injected so tests do not depend on the wall clock. */
  now?: string
}

/** Turns parsed drafts into pending proposals, flagging likely duplicates. */
export const toProposals = (
  knowledge: ExtractedKnowledge,
  context: ProposalsContext,
): SynthesisProposal[] => {
  const createdAt = context.now ?? new Date().toISOString()
  const base = {
    noteId: context.note.id,
    noteName: context.note.name,
    model: context.model,
    provider: context.provider,
    createdAt,
    status: 'pending' as const,
    confidence: DEFAULT_EXTRACTION_CONFIDENCE,
  }
  const entityProposals: SynthesisProposal[] = knowledge.entities.map((entity) => ({
    ...base,
    kind: 'entity',
    id: crypto.randomUUID(),
    name: entity.name,
    entityType: entity.entityType,
    description: entity.description,
    evidence: entity.evidence,
    duplicateOf: findDuplicateEntity(entity.name, context.entities)?.id ?? null,
  }))
  const claimProposals: SynthesisProposal[] = knowledge.claims.map((claim) => ({
    ...base,
    kind: 'claim',
    id: crypto.randomUUID(),
    statement: claim.statement,
    entityName: claim.entityName,
    confidence: claim.confidence,
    evidence: claim.evidence,
    duplicateOf: null,
  }))
  return [...entityProposals, ...claimProposals]
}

/** Injected completion call, so the pipeline is testable without a provider. */
export type ExtractionSender = (
  messages: ChatMessage[],
  signal?: AbortSignal,
) => Promise<ChatResult>

/** Runs one extraction and returns proposals, or a safe failure reason. */
export const runExtraction = async ({
  note,
  request,
  entities,
  signal,
  send,
  now,
}: {
  note: Entity
  request: ExtractionRequest
  entities: readonly Entity[]
  signal?: AbortSignal
  send: ExtractionSender
  now?: string
}): Promise<{ ok: true; proposals: SynthesisProposal[] } | { ok: false; reason: ExtractionFailure }> => {
  if (clipExtractionInput(note.content).trim() === '') return { ok: false, reason: 'empty-input' }
  let result: ChatResult
  try {
    result = await send(buildExtractionMessages(note.content), signal)
  } catch (error) {
    if (signal?.aborted === true) throw error
    // Provider failures are reported as one reason: the raw error can carry an
    // upstream body that the inbox must not display (or log as user data).
    return { ok: false, reason: 'provider' }
  }
  const parsed = parseExtractionResponse(result.content, note.content)
  if (!parsed.ok) return parsed
  const proposals = toProposals(parsed.knowledge, {
    note,
    provider: request.provider,
    model: result.model === '' ? request.model : result.model,
    entities,
    now,
  })
  return { ok: true, proposals }
}

/** Provider ids that send note text off the device. */
export const leavesDevice = (provider: ProviderId): boolean => provider === 'openrouter'

/** Default sender bound to the shared chat client. */
export const createExtractionSender = (request: ExtractionRequest): ExtractionSender =>
  (messages, signal) =>
    sendChat({
      provider: request.provider,
      model: request.model,
      apiKey: request.apiKey,
      messages,
      signal,
      ollamaBaseUrl: request.ollamaBaseUrl,
      ollamaCpuOnly: request.ollamaCpuOnly,
      localDevice: request.localDevice,
    })
