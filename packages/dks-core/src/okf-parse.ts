/**
 * OKF v0.2 bundle parsing (mirrors the studio's `src/lib/okf/import.ts`
 * semantics): reserved `index.md` / `log.md` handling, `# Claims` footnote
 * joins, trust-tier derivation, and `# Related` link extraction. This is
 * the single implementation shared by the `dks` CLI and the MCP adapter.
 */

import { parseFrontmatter, splitFrontmatter } from './frontmatter.js'
import { findMachineSection, scanRelativeLinks } from './markdown-scan.js'
import type {
  BundleClaim,
  BundleConcept,
  BundleSource,
  LoadedBundle,
  TrustTier,
} from './types.js'

/**
 * Derives the trust tier from frontmatter `verified` (mirrors trustTier).
 * @param verified - Raw verified value (single entry or list).
 * @returns The tier; anything without a human verifier stays below reviewed.
 */
export const deriveTrustTier = (verified: unknown): TrustTier => {
  if (!verified) return 'unverified'
  const raw: unknown[] = Array.isArray(verified) ? verified : [verified]
  // Non-object entries are schema-invalid; they verify nothing and must not
  // crash the `by` access or masquerade as machine confirmation.
  const events = raw.filter((v): v is { by?: unknown } => typeof v === 'object' && v !== null)
  if (events.length === 0) return 'unverified'
  if (events.some((v) => typeof v.by === 'string' && v.by.startsWith('human:'))) {
    return 'human-reviewed'
  }
  return 'machine-confirmed'
}

/** Reads a string field, falling back to `fallback` for any other shape. */
const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

/** Reads a string array, dropping non-string entries. */
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

/** Reads source entries, dropping entries without a resource. */
const asSources = (value: unknown): BundleSource[] => {
  if (!Array.isArray(value)) return []
  const sources: BundleSource[] = []
  for (const s of value) {
    if (typeof s !== 'object' || s === null) continue
    const record = s as Record<string, unknown>
    if (typeof record.resource !== 'string' || record.resource.length === 0) continue
    const source: BundleSource = { resource: record.resource }
    if (typeof record.id === 'string') source.id = record.id
    if (typeof record.title === 'string') source.title = record.title
    if (typeof record.author === 'string') source.author = record.author
    sources.push(source)
  }
  return sources
}

/**
 * Parses one `- statement[^id]` claim line. Phrased as a slice + anchored
 * footnote match rather than one backtracking pattern, so a long line of
 * `-`/`[^` characters cannot drive exponential matching.
 * @param line - A single body line.
 * @returns The statement and footnote label, or null when not a claim line.
 */
const parseClaimLine = (line: string): { text: string; footnoteId?: string } | null => {
  if (!line.startsWith('- ')) return null
  let text = line.slice(2).trim()
  let footnoteId: string | undefined
  const tail = /\[\^([\w-]+)\]$/.exec(text)
  if (tail) {
    const [, label = ''] = tail
    footnoteId = label
    text = text.slice(0, tail.index).trim()
  }
  return footnoteId ? { text, footnoteId } : { text }
}

/** A parsed claim line: statement plus optional footnote label. */
export interface ClaimLine {
  statement: string
  footnoteId?: string
}

/**
 * Extracts `- statement[^id]` claim lines from a concept body. This is the
 * shared rule for the PWA importer and the CLI/MCP bundle reader.
 * @param body - Concept markdown body.
 * @returns The claim lines in body order.
 */
export const extractClaimLines = (body: string): ClaimLine[] => {
  const claims: ClaimLine[] = []
  for (const line of body.split('\n')) {
    const parsed = parseClaimLine(line)
    if (!parsed) continue
    const text = parsed.text
    if (text.startsWith('[^') || text.includes('Related') || text.includes('# Claims')) {
      continue
    }
    claims.push(parsed.footnoteId ? { statement: text, footnoteId: parsed.footnoteId } : { statement: text })
  }
  return claims
}

/**
 * Extracts claims from a concept body (mirrors `parseClaims` in app code).
 * @param body - Concept markdown body.
 * @param sources - Frontmatter sources for the footnote join.
 * @param verified - Whether the concept is human-reviewed.
 * @returns The recovered claims.
 */
const parseClaims = (
  body: string,
  sources: BundleSource[],
  verified: boolean,
): BundleClaim[] => {
  const sourceById = new Map<string, BundleSource>()
  for (const s of sources) {
    if (s.id) sourceById.set(s.id, s)
  }
  const claims: BundleClaim[] = []
  for (const line of extractClaimLines(body)) {
    const source = line.footnoteId ? sourceById.get(line.footnoteId) : undefined
    const claim: BundleClaim = {
      statement: line.statement,
      verification: verified ? 'verified' : 'unverified',
    }
    if (source?.resource) claim.source = source.resource
    if (source?.title) claim.evidence = source.title
    claims.push(claim)
  }
  return claims
}

/**
 * Extracts `# Related` markdown links as bundle-relative target ids.
 * Exported form is `* [Name](/path/to.md)` where the path is slash-rooted.
 * @param body - Concept markdown body.
 * @returns Target ids (path minus leading slash and `.md`).
 */
const parseRelatedIds = (body: string): string[] => {
  // Linear scanner equivalent of `/# Related\n([\s\S]*?)(?:\n# |$)/`; the
  // differential tests in markdown-scan.test.ts pin the scanners to the
  // reference regexes they replaced (CodeQL polynomial-regex findings).
  const section = findMachineSection(body, 'Related', false)
  const ids: string[] = []
  if (section) {
    for (const span of scanRelativeLinks(section.content)) {
      const target = span.rawTarget.replace(/^\/+/, '').replace(/\.md$/, '')
      if (target && !ids.includes(target)) ids.push(target)
    }
  }
  return ids
}

/**
 * Strips the `# Claims` and `# Related` sections from display content.
 * @param body - Concept markdown body.
 * @returns The body without machine sections.
 */
const stripMachineSections = (body: string): string => {
  // Linear scanner equivalents of the
  // `(?:^|\n)# <title>\n[\s\S]*?(?=\n# |$)` replaces (CodeQL
  // polynomial-regex findings; differential-tested against them).
  const stripSection = (text: string, title: string): string => {
    const section = findMachineSection(text, title, true)
    return section === null ? text : text.slice(0, section.start) + text.slice(section.end)
  }
  // `(?:^|\n)` keeps a section heading that opens the body strippable too.
  return stripSection(stripSection(body, 'Claims'), 'Related').trim()
}

/**
 * Parses one concept file into a BundleConcept.
 * @param path - Bundle-relative path (id is the path minus `.md`).
 * @param content - Raw file content.
 * @returns The concept, or null when the file is not a valid concept.
 */
export const parseConcept = (path: string, content: string): BundleConcept | null => {
  const split = splitFrontmatter(content)
  if (!split.frontmatter) return null
  const parsed = parseFrontmatter(split.frontmatter)
  if (!parsed.ok) return null
  const fm = parsed.data
  const fileName = path.split('/').pop() ?? path
  const sources = asSources(fm.sources)
  const tier = deriveTrustTier(fm.verified)
  const name = asString(fm.title, fileName.replace(/\.md$/, ''))
  const concept: BundleConcept = {
    id: path.replace(/\.md$/, ''),
    name,
    type: asString(fm.type, 'Concept'),
    description: asString(fm.description, ''),
    content: stripMachineSections(split.body),
    tags: asStringArray(fm.tags),
    trustTier: tier,
    sources,
    claims: parseClaims(split.body, sources, tier === 'human-reviewed'),
    relatedIds: parseRelatedIds(split.body),
  }
  const aliases = asStringArray(fm.aliases)
  if (aliases.length > 0) concept.aliases = aliases
  return concept
}

/**
 * Rejects paths that escape the bundle namespace (mirrors the app importer).
 * @param path - Candidate bundle-relative path.
 * @returns True when the path is safe to consume.
 */
export const isSafePath = (path: string): boolean => {
  if (!path || path.includes('\0')) return false
  if (/^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)) return false
  if (path.split('/').includes('..')) return false
  return true
}

/** Declared `okf_version` from an index file, or null when absent. */
export const parseIndexVersion = (content: string): string | null => {
  const m = /okf_version:\s*['"]?([\w.]+)['"]?/.exec(content)
  return m?.[1] ?? null
}
/** Declared `okf_version` from an index file's frontmatter (shared rule). */
export const parseIndexFrontmatterVersion = (content: string): string | null => {
  const split = splitFrontmatter(content)
  if (!split.frontmatter) return null
  const parsed = parseFrontmatter(split.frontmatter)
  if (!parsed.ok) return null
  const version = parsed.data.okf_version
  return typeof version === 'string' ? version : null
}
/** Neutral entity produced by the shared OKF import service. */
export interface ImportedEntityLike {
  id: string
  name: string
  type: string
  description: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** Neutral claim produced by the shared OKF import service. */
export interface ImportedClaimLike {
  entityId: string
  statement: string
  verification: 'verified' | 'unverified'
  confidence: number
  source?: string
  evidence?: string
  createdAt: string
  updatedAt: string
  version: number
}

/** Result of the shared OKF import service. */
export interface OkfImportServiceResult {
  entities: ImportedEntityLike[]
  claims: ImportedClaimLike[]
  errors: string[]
}

/** Maps OKF type strings back to studio entity types (unknown types → 'concept'). */
const OKF_TYPE_REVERSE: Record<string, string> = {
  Note: 'note',
  Concept: 'concept',
  Person: 'person',
  Project: 'project',
}

/**
 * Shared OKF import service: validates a bundle and parses every concept
 * into neutral entities/claims. Reserved-file handling, version checks,
 * path guards, and per-file validation all live here; the PWA adapter maps
 * the neutral output onto studio records (UUIDs, presentation).
 */
export const parseOkfImportBundle = (
  files: Map<string, string>,
  nowIso = new Date().toISOString(),
): OkfImportServiceResult => {
  const result: OkfImportServiceResult = { entities: [], claims: [], errors: [] }
  for (const [path, content] of files) {
    if (/^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)) {
      result.errors.push(`${path}: not a bundle-relative path (drive-rooted, absolute, or root-backslash names are invalid per §2)`)
      continue
    }
    if (/(^|\/)index\.md$/.test(path)) {
      const declared = parseIndexFrontmatterVersion(content)
      if (!declared) {
        result.errors.push('index.md: missing okf_version — not a valid OKF bundle')
      } else if (declared !== '0.2' && !declared.startsWith('0.2.')) {
        result.errors.push(`index.md: unsupported okf_version "${declared}" (expected 0.2.x)`)
      }
      continue
    }
    if (/(^|\/)log\.md$/.test(path)) continue
    const concept = parseConcept(path, content)
    if (!concept) {
      result.errors.push(`${path}: missing or unparseable frontmatter`)
      continue
    }
    const split = splitFrontmatter(content)
    const rawBody = split.frontmatter !== null ? split.body : content
    const entity: ImportedEntityLike = {
      id: concept.id,
      name: concept.name,
      type: OKF_TYPE_REVERSE[concept.type] ?? 'concept',
      description: concept.description,
      content: rawBody.trim(),
      tags: concept.tags,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    result.entities.push(entity)
    for (const claim of concept.claims) {
      const imported: ImportedClaimLike = {
        entityId: entity.id,
        statement: claim.statement,
        verification: claim.verification,
        confidence: 1.0,
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
      }
      if (claim.source) imported.source = claim.source
      if (claim.evidence) imported.evidence = claim.evidence
      result.claims.push(imported)
    }
  }
  return result
}

/**
 * Parses a bundle from a normalized file map (bundle-relative path →
 * content). Fail-closed: an incompatible or missing index throws before any
 * concept is served.
 * @param files - Bundle-relative path → UTF-8 content.
 * @returns The loaded concepts plus non-fatal warnings.
 */
export const parseBundleFiles = (files: Map<string, string>): LoadedBundle => {
  const indexEntry = [...files.keys()].find((p) => /(^|\/)index\.md$/.test(p))
  const declared = indexEntry ? parseIndexVersion(files.get(indexEntry) ?? '') : null
  if (!declared) {
    throw new Error('Not a valid OKF bundle: index.md with okf_version is required.')
  }
  if (declared !== '0.2' && !declared.startsWith('0.2.')) {
    throw new Error(`Unsupported okf_version "${declared}" (expected 0.2.x).`)
  }

  const concepts: BundleConcept[] = []
  const warnings: string[] = []
  for (const [path, content] of files) {
    if (/(^|\/)index\.md$/.test(path) || /(^|\/)log\.md$/.test(path)) continue
    const concept = parseConcept(path, content)
    if (!concept) {
      warnings.push(`${path}: no readable frontmatter and was skipped.`)
      continue
    }
    concepts.push(concept)
  }
  if (concepts.length === 0) {
    throw new Error('Bundle holds no parseable concepts; refusing to serve an empty library.')
  }
  return { concepts, warnings }
}
