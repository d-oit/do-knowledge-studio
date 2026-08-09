import yaml from 'yaml'
import type { z } from 'zod'
import { OkfConceptFrontmatterSchema } from './types'
import type { Entity, Claim } from '@/lib/studio/types'
import { trustTier } from './trust'

/**
 * Generates a UUID v4. Uses the Web Crypto API when available (browsers and
 * modern Node), falling back to a Math.random-based v4 for non-secure runtimes
 * so the importer never throws when `crypto` is not a global.
 * @returns A UUID v4 string.
 */
const uuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC 4122 v4 fallback for runtimes without Web Crypto (e.g. older workers).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Result of parsing an OKF bundle: entities, claims, and non-fatal errors. */
export interface OkfImportResult {
  /** Entities to serialize. */
  entities: Entity[]
  /** The library claims being processed. */
  claims: Claim[]
  /** The errors. */
  errors: string[]
}

/** Maps OKF type strings back to studio entity types (unknown types → 'concept'). */
const OKF_TYPE_REVERSE: Record<string, Entity['type']> = {
  Note: 'note',
  Concept: 'concept',
  Person: 'person',
  Project: 'project',
}

/**
 * Builds a studio Entity from parsed OKF frontmatter + body.
 * Unknown types fall back to 'concept' and unknown keys are preserved (§4.1/§11).
 * @param fm - Parsed OKF frontmatter.
 * @param path - Bundle-relative file path; the id is the path minus `.md` (§2).
 * @param bodyContent - Markdown body stored as entity content.
 * @param nowIso - ISO timestamp used for createdAt/updatedAt.
 * @returns The studio Entity.
 */
const buildEntity = (
  fm: z.infer<typeof OkfConceptFrontmatterSchema>,
  path: string,
  bodyContent: string,
  nowIso: string,
): Entity => {
  /** Unique identifier. */
  const id = path.replace(/\.md$/, '') // Concept ID = path minus .md (§2)
  /** The file name. */
  const fileName = path.split('/').pop() ?? ''
  return {
    id,
    /** Human-readable name. */
    name: fm.title ?? fileName.replace(/\.md$/, ''),
    /** Entity type. */
    type: OKF_TYPE_REVERSE[fm.type] ?? 'concept', // unknown types tolerated (§11)
    /** One-line summary of the item. */
    description: fm.description ?? '',
    /** Markdown or text content. */
    content: bodyContent.trim(),
    /** Optional tags payload carried through the operation. */
    tags: fm.tags ?? [],
    /** ISO timestamp of claim creation. */
    createdAt: nowIso,
    /** ISO timestamp of the last claim update. */
    updatedAt: nowIso,
    /** Related entity links. */
    links: [],
  }
}

/**
 * Extracts claims from a concept body: `- statement[^src-N]` lines are parsed and
 * footnote labels are joined back to sources[].id (§5.1).
 *
 * Claim verification is derived from the concept's trust tier (§5.3) rather than
 * hardcoded: only concepts carrying a human verifier map to 'verified'; anything
 * else is imported as 'unverified' to avoid misrepresenting the claim state.
 * @param bodyContent - The concept's markdown body.
 * @param entity - The owning entity for the extracted claims.
 * @param fm - Parsed OKF frontmatter (sources + verified).
 * @param nowIso - ISO timestamp used for createdAt/updatedAt.
 * @returns The extracted claims.
 */
const parseClaims = (
  bodyContent: string,
  entity: Entity,
  fm: z.infer<typeof OkfConceptFrontmatterSchema>,
  nowIso: string,
): Claim[] => {
  /** The source by id. */
  const sourceById = new Map<string, { resource: string; title?: string }>()
  for (const s of fm.sources ?? []) {
    if (s.id) sourceById.set(s.id, s)
  }
  /** Claim verification status. */
  const verification = trustTier(fm.verified) === 'human-reviewed' ? 'verified' : 'unverified'

  /** The claim regex. */
  const claimRegex = /^- ([^\n]+?)(?:\[\^([\w-]+)\])?$/gm
  /** The library claims being processed. */
  const claims: Claim[] = []
  for (const m of bodyContent.matchAll(claimRegex)) {
    /** The claim text. */
    const claimText = m[1].trim()
    // Skip footnote definitions and structural headings themselves
    if (claimText.startsWith('[^') || claimText.includes('Related') || claimText.includes('# Claims')) {
      continue
    }
    /** The source obj. */
    const sourceObj = m[2] ? sourceById.get(m[2]) : undefined
    claims.push({
      /** Unique identifier. */
      id: uuid(),
      /** Owning entity id. */
      entityId: entity.id,
      /** The claim statement text. */
      statement: claimText,
      /** Claim confidence score. */
      confidence: 1.0,
      verification,
      /** Source resource for the claim. */
      source: sourceObj?.resource,
      /** Supporting evidence for the claim. */
      evidence: sourceObj?.title,
      /** ISO timestamp of claim creation. */
      createdAt: nowIso,
      /** ISO timestamp of the last claim update. */
      updatedAt: nowIso,
      /** Claim schema version. */
      version: 1,
      /** History of claim edits. */
      editHistory: [],
    })
  }
  return claims
}

/**
 * Parses a single non-reserved OKF file, appending any entities, claims, or
 * errors to the shared result. §11: unknown types, unknown keys, broken links,
 * and missing optional fields must not reject the bundle — collect and continue.
 * @param path - Bundle-relative file path (index.md and log.md are reserved).
 * @param content - Raw file content.
 * @param result - Accumulator that receives entities, claims, and non-fatal errors.
 * @returns True when the file contributed a new entity.
 */
const parseOkfFile = (path: string, content: string, result: OkfImportResult): boolean => {
  /** The match. */
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    result.errors.push(`${path}: missing or unparseable frontmatter`) // §11 conformance rule 1
    return false
  }

  let fmParsed: unknown
  try {
    fmParsed = yaml.parse(match[1])
  } catch (e) {
    result.errors.push(`${path}: invalid YAML frontmatter: ${e instanceof Error ? e.message : 'unknown error'}`)
    return false
  }

  /** The parsed. */
  const parsed = OkfConceptFrontmatterSchema.safeParse(fmParsed)
  if (!parsed.success) {
    result.errors.push(`${path}: ${parsed.error.issues[0]?.message ?? 'invalid frontmatter'}`)
    return false
  }

  /** The fm. */
  const fm = parsed.data // passthrough preserves unknown keys for round-trip (§4.1)
  /** The now iso. */
  const nowIso = new Date().toISOString()
  /** The entity. */
  const entity = buildEntity(fm, path, match[2], nowIso)
  result.entities.push(entity)
  result.claims.push(...parseClaims(match[2], entity, fm, nowIso))
  return true
}

/**
 * Parse an OKF bundle (path → content) back into studio state.
 * §11: MUST NOT reject unknown types, unknown keys, broken links, or missing
 * optional fields — collect errors/warnings and continue.
 * @param files - Map of bundle-relative path → file content.
 * @returns Entities, claims, and any non-fatal parse errors.
 */
export const parseOkfBundle = (files: Map<string, string>): OkfImportResult => {
  /** The result. */
  const result: OkfImportResult = { entities: [], claims: [], errors: [] }

  for (const [path, content] of files) {
    if (/(^|\/)index\.md$/.test(path) || /(^|\/)log\.md$/.test(path)) {
      continue // reserved (§3.1)
    }
    parseOkfFile(path, content, result)
  }
  return result
}