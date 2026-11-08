/**
 * Types for AI-assisted extraction and its review inbox (#1057).
 *
 * A model never writes to the corpus. It produces drafts, the drafts become
 * {@link SynthesisProposal} records in their own store slice, and only an
 * explicit accept turns one into an entity or a claim (ADR 054).
 */
import type { AnyEntityType } from '@/lib/studio/types'

/** What a proposal would create if accepted. */
export type SynthesisProposalKind = 'entity' | 'claim'

/** Review lifecycle of one proposal. */
export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

/** Fields every proposal carries, whatever it would create. */
interface ProposalBase {
  id: string
  /** Entity the extraction ran on. */
  noteId: string
  /** Name of that entity at extraction time, so the inbox reads without a join. */
  noteName: string
  /** Model identifier recorded as provenance on accept. */
  model: string
  /** Provider the request went to; decides the privacy disclosure. */
  provider: string
  createdAt: string
  /** Quoted span of the note the proposal cites; empty when no quote matched. */
  evidence: string
  /** Model-reported confidence, clamped to 0..1. */
  confidence: number
  status: ProposalStatus
  /** Existing entity this proposal appears to restate, if any. */
  duplicateOf: string | null
}

/** A proposal to create an entity. */
export interface EntityProposal extends ProposalBase {
  kind: 'entity'
  name: string
  entityType: AnyEntityType
  description: string
}

/** A proposal to create a claim on the source note. */
export interface ClaimProposal extends ProposalBase {
  kind: 'claim'
  statement: string
  /** Entity name the model attached the claim to, when it named one. */
  entityName: string | null
}

/** One reviewable proposal. */
export type SynthesisProposal = EntityProposal | ClaimProposal

/** Entity draft produced by parsing a model response. */
export interface ExtractedEntity {
  name: string
  entityType: AnyEntityType
  description: string
  evidence: string
}

/** Claim draft produced by parsing a model response. */
export interface ExtractedClaim {
  statement: string
  entityName: string | null
  confidence: number
  evidence: string
}

/** The usable part of a model response. */
export interface ExtractedKnowledge {
  entities: ExtractedEntity[]
  claims: ExtractedClaim[]
}

/**
 * Why a model response could not be turned into proposals.
 *
 * Every value is a safe, non-model-derived reason: the UI maps it to a
 * message, and no raw provider payload is ever surfaced.
 */
export type ExtractionFailure =
  | 'empty-input'
  | 'provider'
  | 'too-large'
  | 'not-json'
  | 'schema'
  | 'too-many'
  | 'empty'

/** Provider request settings a caller must supply. */
export interface ExtractionRequest {
  provider: 'openrouter' | 'ollama' | 'local'
  model: string
  apiKey: string
  ollamaBaseUrl?: string
  ollamaCpuOnly?: boolean
  localDevice?: 'wasm' | 'webgpu'
}
