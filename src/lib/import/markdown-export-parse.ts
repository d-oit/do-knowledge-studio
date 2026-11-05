import type { Claim, Entity, VerificationStatus } from '@/lib/studio/types'
import {
  buildVaultLinkIndex,
  convertVaultLinks,
  type MarkdownImportResult,
  type VaultEntityDraft,
} from './markdown-import'

/**
 * Round-trip parser for `buildMarkdownExport` output (issue #1054).
 *
 * The single-file Markdown export is the only shape this module reads: it is
 * detected by the `# DO Knowledge Studio — export` header and reversed
 * section by section (`---` separators, `# Name` headings, `**Type:**` /
 * `**Tags:**` metadata, `**Links:**`, `## Claims`). Wikilinks in content are
 * re-resolved against the section names through the shared vault linker, so
 * export → import preserves the link graph by name (ids are library-local and
 * are re-derived).
 */

/** First line of every Markdown export file. */
export const MARKDOWN_EXPORT_HEADER = '# DO Knowledge Studio — export'

/** Claim confidence percent shown in export lines (`confidence: 90%`). */
const CLAIM_LINE_PATTERN =
  /^- \[(unverified|verified|disputed)\] (.+) \(confidence: (\d+)%(, source: (.+?))?\)( — _(.+)_)?$/

/** `**Tags:** #a  #b` line → tag names. */
const EXPORT_TAG_PATTERN = /#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu

/** `- → <targetId> — <relation>` line in the `**Links:**` block. */
const LINK_LINE_PATTERN = /^- → (.+) — (.+)$/

/** A metadata line belongs to the header block, never to the body content. */
const isMetadataLine = (line: string): boolean =>
  line.startsWith('**Type:**') ||
  line.startsWith('**Tags:**') ||
  line.startsWith('**Source:**') ||
  line.startsWith('**Created:**') ||
  line.startsWith('**Updated:**') ||
  line.startsWith('> ') ||
  line === '_(no body content)_'

/** One parsed claim line from a `## Claims` block. */
interface ExportClaim {
  verification: VerificationStatus
  statement: string
  confidence: number
  source?: string
  evidence?: string
}

/** One parsed export section before link resolution. */
interface ExportSection {
  name: string
  type: Entity['type']
  tags: string[]
  description: string
  content: string
  createdAt: string
  updatedAt: string
  links: { targetId: string; relation: string }[]
  claims: ExportClaim[]
}

/** True when the text is a Markdown export file (not a vault note). */
export const isMarkdownExportFile = (text: string): boolean =>
  text.startsWith(MARKDOWN_EXPORT_HEADER)

/** Parses one `## Claims` line; null for unparseable lines. */
const parseClaimLine = (line: string): ExportClaim | null => {
  const match = line.match(CLAIM_LINE_PATTERN)
  if (!match) return null
  const source = match[5]?.trim()
  return {
    verification: (match[1] ?? 'unverified') as VerificationStatus,
    statement: (match[2] ?? '').trim(),
    confidence: Math.min(100, Math.max(0, Number(match[3] ?? '100'))) / 100,
    ...(source ? { source } : {}),
    ...(match[7] ? { evidence: match[7] } : {}),
  }
}

/**
 * Splits an export section into metadata, content, links, and claims. The
 * `**Links:**` / `## Claims` markers match at their LAST exact-line occurrence
 * so entity prose containing those words still parses.
 */
const parseSection = (section: string, warnings: string[]): ExportSection | null => {
  const lines = section.split('\n')
  const titleLine = lines[0] ?? ''
  if (!titleLine.startsWith('# ')) {
    warnings.push(`Skipping a section without a "# Name" heading ("${titleLine.slice(0, 40)}…")`)
    return null
  }
  const name = titleLine.slice(2).trim()
  if (name === '') {
    warnings.push('Skipping a section with an empty entity name')
    return null
  }

  let type: Entity['type'] = 'concept'
  let tags: string[] = []
  let createdAt = ''
  let updatedAt = ''
  const descriptionParts: string[] = []
  const contentLines: string[] = []
  const links: ExportSection['links'] = []
  const claims: ExportClaim[] = []

  let linksAt = -1
  let claimsAt = -1
  lines.forEach((line, index) => {
    if (line === '**Links:**') linksAt = index
    else if (line === '## Claims') claimsAt = index
  })
  const metaEnd = Math.min(
    linksAt === -1 ? lines.length : linksAt,
    claimsAt === -1 ? lines.length : claimsAt,
  )

  for (let index = 1; index < metaEnd; index += 1) {
    const line = lines[index] ?? ''
    if (line.startsWith('**Type:**')) {
      const raw = line.slice('**Type:**'.length).trim().toLowerCase()
      if (raw === 'note' || raw === 'concept' || raw === 'person' || raw === 'project') type = raw
    } else if (line.startsWith('**Tags:**')) {
      EXPORT_TAG_PATTERN.lastIndex = 0
      tags = Array.from(line.matchAll(EXPORT_TAG_PATTERN))
        .map((m) => m[1] ?? '')
        .filter((t) => t !== '')
    } else if (line.startsWith('**Created:**')) {
      const parsed = new Date(line.slice('**Created:**'.length).trim())
      if (!Number.isNaN(parsed.getTime())) createdAt = parsed.toISOString()
    } else if (line.startsWith('**Updated:**')) {
      const parsed = new Date(line.slice('**Updated:**'.length).trim())
      if (!Number.isNaN(parsed.getTime())) updatedAt = parsed.toISOString()
    } else if (line.startsWith('> ')) {
      descriptionParts.push(line.slice(2))
    } else if (line === '' || line === '_(no body content)_' || line.startsWith('**Source:**')) {
      // Export padding, placeholders, and decoration carry no content.
    } else if (isMetadataLine(line)) {
      // Covered above; kept for exhaustiveness.
    } else {
      contentLines.push(line)
    }
  }

  if (linksAt !== -1) {
    const linksEnd = claimsAt === -1 || claimsAt < linksAt ? lines.length : claimsAt
    for (let index = linksAt + 1; index < linksEnd; index += 1) {
      const linkMatch = (lines[index] ?? '').match(LINK_LINE_PATTERN)
      if (linkMatch) links.push({ targetId: linkMatch[1] ?? '', relation: linkMatch[2] ?? '' })
    }
  }

  if (claimsAt !== -1) {
    for (let index = claimsAt + 1; index < lines.length; index += 1) {
      const line = (lines[index] ?? '').trim()
      if (line === '' || line === '_(none)_') continue
      const claim = parseClaimLine(line)
      if (claim) claims.push(claim)
      else warnings.push(`"${name}": skipping unparseable claim line "${line.slice(0, 60)}"`)
    }
  }

  return {
    name,
    type,
    tags,
    description: descriptionParts.join('\n'),
    content: contentLines.join('\n').trim(),
    createdAt,
    updatedAt,
    links,
    claims,
  }
}

/**
 * Parses a Markdown export file back into entities + claims. Returns
 * `success: false` when the text is not an export file or holds no sections.
 */
export const parseMarkdownExport = (text: string): MarkdownImportResult => {
  if (!isMarkdownExportFile(text)) {
    return { success: false, error: 'Not a Markdown export file (missing export header).' }
  }
  const warnings: string[] = []
  // A `---` horizontal rule inside entity prose splits naively too, so chunks
  // only start a new section when they open with a `# Name` heading — the
  // rest are continuations glued back onto the running section verbatim.
  const rawSections: string[] = []
  for (const chunk of text.split('\n---\n').slice(1)) {
    /** The chunk without the blank padding the exporter wraps sections in. */
    const clean = chunk.replace(/^\n+/, '').replace(/\n+$/, '')
    if (clean.startsWith('# ')) rawSections.push(clean)
    else if (rawSections.length > 0) rawSections[rawSections.length - 1] += `\n---\n${clean}`
    else warnings.push('Skipping export content before the first entity section')
  }
  const nowIso = new Date().toISOString()

  const sections: ExportSection[] = []
  rawSections.forEach((raw) => {
    const section = parseSection(raw, warnings)
    if (section) sections.push(section)
  })
  if (sections.length === 0) {
    return { success: false, error: 'No entity sections found in the Markdown export file.' }
  }

  const drafts: VaultEntityDraft[] = sections.map((section, position) => ({
    id: `import-${position}-${section.name.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
    name: section.name,
    type: section.type,
    description: section.description,
    content: section.content,
    tags: section.tags,
    createdAt: section.createdAt === '' ? nowIso : section.createdAt,
    updatedAt: section.updatedAt === '' ? nowIso : section.updatedAt,
  }))

  // Re-resolve [[wikilinks]] against the section names; exported `**Links:**`
  // targets are matched by name below since ids are library-local.
  const index = buildVaultLinkIndex(drafts)
  const unresolved = new Map<string, string>()
  const linked = drafts.map((draft) => ({
    ...draft,
    content: convertVaultLinks(draft.content, '', index, unresolved),
  }))
  for (const name of unresolved.values()) {
    warnings.push(`"${name}": no matching entity — left as plain text`)
  }

  const entities: Entity[] = linked.map((draft, position) => {
    const section = sections[position] as ExportSection
    // NOTE: `**Links:**` targets are library-local ids, which the Markdown
    // export does not preserve — only `[[Name]]` references in content
    // survive the round-trip (re-resolved above). Named targets that still
    // match are kept as a courtesy; the rest are dropped, not stubbed.
    const links = section.links
      .map((link) => {
        const target =
          linked.find((d) => d.name === link.targetId) ??
          linked.find((d) => d.name.trim().toLowerCase() === link.targetId.trim().toLowerCase())
        return target ? { targetId: target.id, relation: link.relation } : null
      })
      .filter((l): l is { targetId: string; relation: string } => l !== null)
    return {
      id: draft.id,
      name: draft.name,
      type: draft.type,
      description: draft.description,
      content: draft.content,
      tags: draft.tags,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      links,
    }
  })

  const claims: Claim[] = []
  linked.forEach((draft, position) => {
    const section = sections[position] as ExportSection
    for (const claim of section.claims) {
      claims.push({
        id: crypto.randomUUID(),
        entityId: draft.id,
        statement: claim.statement,
        confidence: claim.confidence,
        verification: claim.verification,
        source: claim.source,
        evidence: claim.evidence,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        version: 1,
        editHistory: [],
      })
    }
  })

  return { success: true, entities, claims, stubNames: [], conflicts: [], warnings }
}
