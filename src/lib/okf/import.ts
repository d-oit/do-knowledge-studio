import yaml from 'yaml'
import { OkfConceptFrontmatterSchema } from './types'
import type { Entity, Claim } from '@/lib/studio/types'

export interface OkfImportResult {
  entities: Entity[]
  claims: Claim[]
  errors: string[]
}

const OKF_TYPE_REVERSE: Record<string, Entity['type']> = {
  Note: 'note',
  Concept: 'concept',
  Person: 'person',
  Project: 'project',
}

/** Parse an OKF bundle (path → content) back into studio state.
 * §11: MUST NOT reject unknown types, unknown keys, broken links, or missing
 * optional fields — collect errors/warnings and continue. */
export function parseOkfBundle(files: Map<string, string>): OkfImportResult {
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

    const frontmatterText = match[1]
    const bodyContent = match[2]

    let fmParsed: unknown
    try {
      fmParsed = yaml.parse(frontmatterText)
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
    const id = path.replace(/\.md$/, '') // Concept ID = path minus .md (§2)

    const entity: Entity = {
      id,
      name: fm.title ?? path.split('/').pop()!.replace(/\.md$/, ''),
      type: OKF_TYPE_REVERSE[fm.type] ?? 'concept', // unknown types tolerated (§11)
      description: fm.description ?? '',
      content: bodyContent.trim(),
      tags: fm.tags ?? [],
      createdAt: nowIso,
      updatedAt: nowIso,
      links: [],
    }
    result.entities.push(entity)

    // Per-claim attribution: footnote labels join back to sources[].id (§5.1)
    const sourceById = new Map((fm.sources ?? []).filter((s) => s.id).map((s) => [s.id!, s]))

    // We parse footnotes as claims by extracting the claim lines and checking if there's a footnote label like [^src-1]
    // Example format:
    // - Claim text[^src-1]
    const claimRegex = /^- ([^\n]+?)(?:\[\^([\w-]+)\])?$/gm
    const matches = bodyContent.matchAll(claimRegex)
    for (const m of matches) {
      const claimText = m[1].trim()
      // Skip footnotes and header definitions themselves
      if (claimText.startsWith('[^') || claimText.includes('Related') || claimText.includes('# Claims')) {
        continue
      }
      const sourceId = m[2]
      const sourceObj = sourceId ? sourceById.get(sourceId) : undefined

      result.claims.push({
        id: crypto.randomUUID(),
        entityId: entity.id,
        statement: claimText,
        confidence: 1.0,
        verification: 'verified',
        source: sourceObj?.resource,
        evidence: sourceObj?.title,
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
        editHistory: [],
      })
    }
  }
  return result
}
