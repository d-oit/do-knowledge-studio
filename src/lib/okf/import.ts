import yaml from 'yaml'
import type { z } from 'zod'
import { OkfConceptFrontmatterSchema } from './types'
import type { Entity, Claim } from '@/lib/studio/types'
import { trustTier } from './trust'

/** Result of parsing an OKF bundle: entities, claims, and non-fatal errors. */
export interface OkfImportResult {
  entities: Entity[]
  claims: Claim[]
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
  const id = path.replace(/\.md$/, '') // Concept ID = path minus .md (§2)
  const fileName = path.split('/').pop() ?? ''
  return {
    id,
    name: fm.title ?? fileName.replace(/\.md$/, ''),
    type: OKF_TYPE_REVERSE[fm.type] ?? 'concept', // unknown types tolerated (§11)
    description: fm.description ?? '',
    content: bodyContent.trim(),
    tags: fm.tags ?? [],
    createdAt: nowIso,
    updatedAt: nowIso,
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
  const sourceById = new Map<string, { resource: string; title?: string }>()
  for (const s of fm.sources ?? []) {
    if (s.id) sourceById.set(s.id, s)
  }
  const verification = trustTier(fm.verified) === 'human-reviewed' ? 'verified' : 'unverified'

  const claimRegex = /^- ([^\n]+?)(?:\[\^([\w-]+)\])?$/gm
  const claims: Claim[] = []
  for (const m of bodyContent.matchAll(claimRegex)) {
    const claimText = m[1].trim()
    // Skip footnote definitions and structural headings themselves
    if (claimText.startsWith('[^') || claimText.includes('Related') || claimText.includes('# Claims')) {
      continue
    }
    const sourceObj = m[2] ? sourceById.get(m[2]) : undefined
    claims.push({
      id: crypto.randomUUID(),
      entityId: entity.id,
      statement: claimText,
      confidence: 1.0,
      verification,
      source: sourceObj?.resource,
      evidence: sourceObj?.title,
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      editHistory: [],
    })
  }
  return claims
}

/**
 * Parse an OKF bundle (path → content) back into studio state.
 * §11: MUST NOT reject unknown types, unknown keys, broken links, or missing
 * optional fields — collect errors/warnings and continue.
 * @param files - Map of bundle-relative path → file content.
 * @returns Entities, claims, and any non-fatal parse errors.
 */
export const parseOkfBundle = (files: Map<string, string>): OkfImportResult => {
  const result: OkfImportResult = { entities: [], claims: [], errors: [] }

  for (const [path, content] of files) {
    if (/(^|\/)index\.md$/.test(path) || /(^|\/)log\.md$/.test(path)) {
      continue // reserved (§3.1)
    }

    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
      result.errors.push(`${path}: missing or unparseable frontmatter`) // §11 conformance rule 1
      continue
    }

    let fmParsed: unknown
    try {
      fmParsed = yaml.parse(match[1])
    } catch (e) {
      result.errors.push(`${path}: invalid YAML frontmatter: ${e instanceof Error ? e.message : 'unknown error'}`)
      continue
    }

    const parsed = OkfConceptFrontmatterSchema.safeParse(fmParsed)
    if (!parsed.success) {
      result.errors.push(`${path}: ${parsed.error.issues[0]?.message ?? 'invalid frontmatter'}`)
      continue
    }

    const fm = parsed.data // passthrough preserves unknown keys for round-trip (§4.1)
    const nowIso = new Date().toISOString()
    const entity = buildEntity(fm, path, match[2], nowIso)
    result.entities.push(entity)
    result.claims.push(...parseClaims(match[2], entity, fm, nowIso))
  }
  return result
}
