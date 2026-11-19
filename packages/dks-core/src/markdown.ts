/**
 * Markdown / Obsidian-vault import service shared by the PWA and the CLI.
 *
 * The service is responsible for every validation and parsing rule:
 * fail-closed batch limits, vault-relative path guards, frontmatter mapping
 * (title/type/description/tags/aliases/created), `#tag` extraction, and
 * link-span scanning (`[[Wikilinks]]` + relative `.md` links). The PWA
 * adapter calls {@link parseMarkdownImport} and keeps only editor-specific
 * presentation (mention-token rendering, claim extraction, UUID stub
 * minting) on its side; the CLI uses {@link parseMarkdownBundle} directly.
 */

import { parseFrontmatterYaml, splitFrontmatter } from './frontmatter.js'
import { scanRelativeLinks, scanWikilinks } from './markdown-scan.js'
import type { CoreEntity } from './types.js'

/** Maximum `.md` files accepted in one import batch. */
export const MAX_MARKDOWN_FILES = 500
/** Maximum characters read from a single `.md` file. */
export const MAX_MARKDOWN_FILE_BYTES = 1_048_576
/** Maximum total characters across all `.md` files in one batch. */
export const MAX_MARKDOWN_TOTAL_BYTES = 20_971_520
/** File extensions treated as importable notes. */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown']

/** Frontmatter keys mapped onto entity fields; others are warned and ignored. */
const KNOWN_FRONTMATTER_KEYS: ReadonlySet<string> = new Set([
  'title',
  'tags',
  'aliases',
  'type',
  'created',
  'description',
])

/** Obsidian type strings mapped onto entity types (unknown → concept). */
const VAULT_TYPE_MAP: Record<string, string> = {
  note: 'note',
  concept: 'concept',
  person: 'person',
  project: 'project',
}

/** Matches `#tag` tokens (unicode-aware); headings are filtered by caller. */
const HASHTAG_PATTERN = /(^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu
/** A Markdown heading line — `#tag` on such a line is a heading, not a tag. */
const HEADING_LINE_PATTERN = /^\s*#{1,6}(?:\s|$)/

/** Result of parsing a Markdown / vault batch (CLI shape). */
export type MarkdownImportResult =
  | {
      success: true
      entities: CoreEntity[]
      /** Names that resolved to nothing; stub entities were minted for them. */
      stubNames: string[]
      /** Names shared by several ids (imported anyway — names are not keys). */
      conflicts: string[]
      /** Non-fatal per-file skips and ignored frontmatter keys. */
      warnings: string[]
    }
  | { success: false; error: string }

/** A `[[Wikilink]]` span inside a note body. */
export interface WikiLinkSpan {
  start: number
  end: number
  name: string
  display?: string
}

/** A relative `[text](target)` span inside a note body. */
export interface RelativeLinkSpan {
  start: number
  end: number
  text: string
  /** Decoded target without its fragment. */
  target: string
}


/** Shared link spans for PWA presentation and other Markdown adapters. */
export interface MarkdownLinkSpans {
  wikilinks: WikiLinkSpan[]
  relativeLinks: RelativeLinkSpan[]
}
/** A parsed note before link presentation (shared PWA/CLI draft). */
export interface MarkdownImportDraft {
  id: string
  name: string
  type: string
  description: string
  /** Trimmed body without frontmatter; link rendering is presentation work. */
  content: string
  tags: string[]
  /** Source buckets let adapters preserve their historical tag ordering. */
  frontmatterTags: string[]
  bodyTags: string[]
  aliases?: string[]
  createdAt: string
  updatedAt: string
  /** Span offsets refer to `content`. */
  wikilinks: WikiLinkSpan[]
  relativeLinks: RelativeLinkSpan[]
}

/** Batch result of the shared Markdown import service. */
export type MarkdownImportServiceResult =
  | { success: true; drafts: MarkdownImportDraft[]; warnings: string[] }
  | { success: false; error: string }

/** Slugs a name into a safe, lowercase, kebab-case id. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled'

/** Strips a Markdown extension (`.md` / `.markdown`) from a vault path. */
export const stripMarkdownExtension = (path: string): string =>
  path.replace(/\.markdown$/i, '').replace(/\.md$/i, '')

/** True when the path points at an importable note file. */
export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))

/** Coerces a frontmatter list-ish value (list, string, or flow array). */
const coerceStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') return value.split(/[,\s]+/).filter((v) => v !== '')
  return []
}

/** Extracts `#tags` from a body, skipping headings and fenced/inline code. */
const extractHashtags = (body: string): string[] => {
  const tags: string[] = []
  const seen = new Set<string>()
  let inFence: string | null = null
  for (const line of body.split('\n')) {
    const fence = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      const marker = fence.at(1) ?? ''
      if (inFence === null) inFence = marker
      else if (inFence === marker) inFence = null
      continue
    }
    if (inFence !== null || HEADING_LINE_PATTERN.test(line)) continue
    const withoutInline = line.replace(/`[^`]*`/g, '')
    HASHTAG_PATTERN.lastIndex = 0
    let match = HASHTAG_PATTERN.exec(withoutInline)
    while (match !== null) {
      const tag = match.at(2) ?? ''
      if (tag !== '' && !seen.has(tag)) {
        seen.add(tag)
        tags.push(tag)
      }
      match = HASHTAG_PATTERN.exec(withoutInline)
    }
  }
  return tags
}

/** Decodes a link target and strips its fragment; raw text on bad escapes. */
const decodeTarget = (target: string): string => {
  try {
    return decodeURIComponent(target).split('#')[0] ?? ''
  } catch {
    return target.split('#')[0] ?? ''
  }
}

/** Scans a body for wikilink and relative-link spans. */
export const scanMarkdownLinks = (body: string): MarkdownLinkSpans => {
  // Linear scanners (markdown-scan.ts) replace the global regexes CodeQL
  // flagged as polynomial on adversarial input; behavior is pinned equal by
  // the differential property tests in markdown-scan.test.ts.
  const wikilinks: WikiLinkSpan[] = []
  for (const span of scanWikilinks(body)) {
    const name = span.name.trim()
    if (name !== '') {
      const display = (span.display ?? '').trim()
      wikilinks.push(display !== '' ? { start: span.start, end: span.end, name, display } : { start: span.start, end: span.end, name })
    }
  }
  const relativeLinks: RelativeLinkSpan[] = []
  for (const span of scanRelativeLinks(body)) {
    if (body[span.start - 1] !== '!' && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(span.rawTarget)) {
      relativeLinks.push({
        start: span.start,
        end: span.end,
        text: span.text,
        target: decodeTarget(span.rawTarget).replace(/^\/+/, ''),
      })
    }
  }
  return { wikilinks, relativeLinks }
}

/**
 * Fails closed on batch limits before any parsing happens.
 * @param files - Vault-relative path → raw content.
 * @returns An error message, or null when the batch is within limits.
 */
export const checkVaultLimits = (files: Map<string, string>): string | null => {
  if (files.size === 0) return 'No Markdown files found to import.'
  if (files.size > MAX_MARKDOWN_FILES) {
    return `Too many files (${files.size}); at most ${MAX_MARKDOWN_FILES} Markdown files can be imported at once.`
  }
  let total = 0
  for (const [path, content] of files) {
    const bytes = content.length
    if (bytes > MAX_MARKDOWN_FILE_BYTES) {
      return `"${path}" is too large (${bytes} characters); files are limited to ${MAX_MARKDOWN_FILE_BYTES} characters.`
    }
    total += bytes
    if (total > MAX_MARKDOWN_TOTAL_BYTES) {
      return `Import is too large; Markdown batches are limited to ${MAX_MARKDOWN_TOTAL_BYTES} characters in total.`
    }
  }
  return null
}

/** Parses one vault file into a shared draft; never throws. */
const parseDraftFile = (
  path: string,
  content: string,
  nowIso: string,
  warnings: string[],
): MarkdownImportDraft | null => {
  const split = splitFrontmatter(content)
  const fileName = stripMarkdownExtension(path.split('/').pop() ?? path)
  let name = fileName
  let type = 'concept'
  let description = ''
  let createdAt = nowIso
  let fm: Record<string, unknown> = {}

  if (split.frontmatter !== null) {
    const parsed = parseFrontmatterYaml(split.frontmatter)
    if (!parsed.ok) {
      warnings.push(`${path}: invalid YAML frontmatter — ${parsed.error}`)
      return null
    }
    fm = parsed.data as Record<string, unknown>
    for (const key of Object.keys(fm)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
        warnings.push(`${path}: ignoring unknown frontmatter key "${key}"`)
      }
    }
    if (typeof fm.title === 'string' && fm.title.trim() !== '') name = fm.title.trim()
    if (typeof fm.type === 'string') {
      const mapped = VAULT_TYPE_MAP[fm.type.trim().toLowerCase()]
      if (mapped) type = mapped
      else warnings.push(`${path}: unknown type "${fm.type}" — imported as concept`)
    }
    if (typeof fm.description === 'string') description = fm.description
    if (typeof fm.created === 'string') {
      const parsedDate = new Date(fm.created)
      if (Number.isNaN(parsedDate.getTime())) {
        warnings.push(`${path}: ignoring unparseable created date "${fm.created}"`)
      } else {
        createdAt = parsedDate.toISOString()
      }
    }
  }

  const frontmatterTags = coerceStringList(fm.tags)
  const bodyTags = extractHashtags(split.body)
  const aliases = coerceStringList(fm.aliases)
  const seen = new Set<string>()
  const tags: string[] = []
  for (const tag of [...frontmatterTags, ...bodyTags]) {
    const clean = tag.trim()
    if (clean !== '' && !seen.has(clean)) {
      seen.add(clean)
      tags.push(clean)
    }
  }
  const trimmedContent = split.body.trim()
  const { wikilinks, relativeLinks } = scanMarkdownLinks(trimmedContent)
  const draft: MarkdownImportDraft = {
    id: stripMarkdownExtension(path),
    name,
    type,
    description,
    content: trimmedContent,
    tags,
    frontmatterTags,
    bodyTags,
    createdAt,
    updatedAt: nowIso,
    wikilinks,
    relativeLinks,
  }
  if (aliases.length > 0) draft.aliases = aliases
  return draft
}

/**
 * Shared Markdown import service: validates the batch and parses every note
 * into a neutral draft. No mention tokens, claims, or stubs are minted here.
 */
export const parseMarkdownImport = (files: Map<string, string>): MarkdownImportServiceResult => {
  const limitError = checkVaultLimits(files)
  if (limitError) return { success: false, error: limitError }
  const nowIso = new Date().toISOString()
  const warnings: string[] = []
  const drafts: MarkdownImportDraft[] = []
  for (const [path, content] of files) {
    if (!isMarkdownPath(path)) continue
    if (/^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)) {
      warnings.push(`${path}: not a vault-relative path — file skipped`)
      continue
    }
    const draft = parseDraftFile(path, content, nowIso, warnings)
    if (draft) drafts.push(draft)
  }
  if (drafts.length === 0) {
    return { success: false, error: `No importable notes found. ${warnings.join('; ')}`.trim() }
  }
  return { success: true, drafts, warnings }
}

/**
 * Parses a Markdown vault batch into entities, minting stub entities for
 * unresolved `[[Wikilinks]]`. Deterministic: stubs and conflicts are
 * reported in first-seen order (CLI-facing aggregate).
 */
export const parseMarkdownBundle = (files: Map<string, string>): MarkdownImportResult => {
  const service = parseMarkdownImport(files)
  if (!service.success) return { success: false, error: service.error }

  const drafts = service.drafts
  const byName = new Map<string, string[]>()
  for (const draft of drafts) {
    const key = draft.name.toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), draft.id])
  }
  const conflicts: string[] = []
  for (const ids of byName.values()) {
    if (ids.length > 1) conflicts.push(ids.join(', '))
  }

  const entities: CoreEntity[] = drafts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    description: d.description,
    content: d.content,
    tags: d.tags,
    ...(d.aliases ? { aliases: d.aliases } : {}),
  }))
  const stubNames: string[] = []
  const ids = new Set(drafts.map((d) => d.id))
  const stubs = new Map<string, { id: string; name: string }>()

  const resolveName = (name: string): string | null => {
    const matched = byName.get(name.toLowerCase()) ?? []
    if (matched.length === 1) return matched[0] ?? null
    if (matched.length > 1) {
      if (!conflicts.includes(name)) conflicts.push(name)
      return matched[0] ?? null
    }
    const existing = stubs.get(name.toLowerCase())
    if (existing) return existing.id
    const stubId = slug(name)
    const unique = ids.has(stubId) ? `${stubId}-${stubs.size + 1}` : stubId
    ids.add(unique)
    stubs.set(name.toLowerCase(), { id: unique, name })
    stubNames.push(name)
    return unique
  }

  for (const draft of drafts) {
    const links: Array<{ targetId: string; relation: string }> = []
    for (const link of draft.wikilinks) {
      const targetId = resolveName(link.name)
      if (targetId) links.push({ targetId, relation: 'related' })
    }
    if (links.length > 0) {
      const entity = entities.find((e) => e.id === draft.id)
      if (entity) entity.links = links
    }
  }
  for (const { id, name } of stubs.values()) {
    entities.push({
      id,
      name,
      type: 'concept',
      description: 'Stub entity minted from an unresolved [[Wikilink]].',
      content: '',
      tags: [],
    })
  }

  return { success: true, entities, stubNames, conflicts, warnings: service.warnings }
}
