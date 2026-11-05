import yaml from 'yaml'
import type { Claim, Entity } from '@/lib/studio/types'
import { buildMentionToken, getMentionCodeRanges } from '@/lib/editor/mention'
import { findWikilinkTokens, resolveWikilinkTarget } from '@/lib/editor/wikilinks'
import { extractClaimsFromText } from '@/lib/studio/claim-parser'

/**
 * Markdown / Obsidian-vault import (issue #1054) — pure, framework-free.
 *
 * One entity per `.md` file, two passes: pass 1 parses frontmatter + body per
 * file, pass 2 resolves `[[Wikilinks]]` and relative `.md` links against every
 * parsed entity and mints stub entities for names that resolve to nothing.
 * Malformed files never throw the batch — they are collected as warnings,
 * OKF §11 style. Hard limits fail closed before any entity is built.
 */

/** Maximum `.md` files accepted in one import batch. */
export const MAX_MARKDOWN_FILES = 500

/** Maximum bytes read from a single `.md` file. */
export const MAX_MARKDOWN_FILE_BYTES = 1_048_576

/** Maximum total bytes across all `.md` files in one batch. */
export const MAX_MARKDOWN_TOTAL_BYTES = 20_971_520

/** Maximum compressed bytes accepted for a vault `.zip`. */
export const MAX_VAULT_ZIP_BYTES = 10_485_760

/** Maximum decompressed bytes accepted for a vault `.zip` (zip-bomb guard). */
export const MAX_VAULT_UNCOMPRESSED_BYTES = 52_428_800

/** Maximum entries accepted from a vault `.zip`. */
export const MAX_VAULT_ZIP_ENTRIES = 2_000

/** File extensions treated as importable notes. */
export const MARKDOWN_EXTENSIONS = ['.md', '.markdown']

/** Strips a Markdown extension (`.md` / `.markdown`) from a vault path. */
export const stripMarkdownExtension = (path: string): string =>
  path.replace(/\.markdown$/i, '').replace(/\.md$/i, '')

/** True when the path points at an importable note file. */
export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))

/** Frontmatter keys mapped onto entity fields; everything else is warned + ignored. */
const KNOWN_FRONTMATTER_KEYS = new Set([
  'title',
  'tags',
  'aliases',
  'type',
  'created',
  'description',
])

/** Obsidian type strings mapped onto studio entity types (unknown → concept). */
const VAULT_TYPE_MAP: Record<string, Entity['type']> = {
  note: 'note',
  concept: 'concept',
  person: 'person',
  project: 'project',
}

/** Matches a relative Markdown link `[text](target)`; images are filtered by caller. */
const RELATIVE_LINK_PATTERN = /\[([^\]]*)\]\(([^)\s]+)\)/g

/** Matches `#tag` tokens (unicode-aware); headings and code are filtered by caller. */
const HASHTAG_PATTERN = /(^|\s)#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu

/** A Markdown heading line — `#tag` on such a line is a heading, not a tag. */
const HEADING_LINE_PATTERN = /^\s*#{1,6}(?:\s|$)/

/** Result of parsing a Markdown / vault batch. */
export type MarkdownImportResult =
  | {
      success: true
      entities: Entity[]
      claims: Claim[]
      /** Names that resolved to nothing; stub entities were minted for them. */
      stubNames: string[]
      /** Names shared by several ids (imported anyway — names are not keys). */
      conflicts: string[]
      /** Non-fatal per-file skips and ignored frontmatter keys. */
      warnings: string[]
    }
  | { success: false; error: string }

/** One parsed file before link resolution. */
export interface VaultEntityDraft {
  id: string
  name: string
  type: Entity['type']
  description: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

/**
 * Fails closed on batch limits before any parsing happens, so an oversized
 * or hostile input can never leave partial state behind.
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

/** Coerces a frontmatter `tags`/`aliases` value (list or string) into strings. */
const coerceStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string') return value.split(/[,\s]+/)
  return []
}

/** Splits raw content into frontmatter source + body (null frontmatter when absent). */
const splitFrontmatter = (content: string): { frontmatter: string | null; body: string } => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: null, body: content }
  return { frontmatter: match[1] ?? '', body: match[2] ?? '' }
}

/** True when the `[start, end)` span overlaps any code range. */
const inCode = (
  start: number,
  end: number,
  ranges: readonly { start: number; end: number }[],
): boolean => ranges.some((r) => r.start < end && r.end > start)

/**
 * Extracts `#tags` from a body, skipping headings, fenced/inline code, and
 * tag-like text inside URLs (`example.com/#frag` has no leading space).
 */
export const extractHashtags = (body: string): string[] => {
  const codeRanges = getMentionCodeRanges(body)
  const tags: string[] = []
  const seen = new Set<string>()
  let lineStart = 0
  for (const line of body.split('\n')) {
    if (!HEADING_LINE_PATTERN.test(line)) {
      HASHTAG_PATTERN.lastIndex = 0
      let match = HASHTAG_PATTERN.exec(line)
      while (match !== null) {
        const tag = match[2] ?? ''
        // Match positions are line-relative; code ranges are body-relative —
        // shift by the line offset so multi-line fenced blocks still mask tags.
        const at = lineStart + match.index + (match[1] ?? '').length
        if (tag !== '' && !seen.has(tag) && !inCode(at, at + tag.length + 1, codeRanges)) {
          seen.add(tag)
          tags.push(tag)
        }
        match = HASHTAG_PATTERN.exec(line)
      }
    }
    lineStart += line.length + 1
  }
  return tags
}

/**
 * Parses one vault file into an entity draft. Never throws: problems are
 * collected into `warnings` and the file is skipped (null draft).
 */
const parseVaultFile = (
  path: string,
  content: string,
  nowIso: string,
  warnings: string[],
): VaultEntityDraft | null => {
  const id = stripMarkdownExtension(path)
  const fileName = path.split('/').pop() ?? path
  const fallbackName = stripMarkdownExtension(fileName)
  const { frontmatter, body } = splitFrontmatter(content)

  let name = fallbackName
  const tags: string[] = []
  let type: Entity['type'] = 'concept'
  let description = ''
  let createdAt = nowIso

  if (frontmatter !== null) {
    let parsed: unknown
    try {
      parsed = yaml.parse(frontmatter)
    } catch (error) {
      warnings.push(`${path}: invalid YAML frontmatter — ${error instanceof Error ? error.message : 'unparseable'}`)
      return null
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      warnings.push(`${path}: frontmatter must be a mapping — file skipped`)
      return null
    }
    const fm = parsed as Record<string, unknown>
    for (const key of Object.keys(fm)) {
      if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
        warnings.push(`${path}: ignoring unknown frontmatter key "${key}"`)
      }
    }
    if (typeof fm.title === 'string' && fm.title.trim() !== '') name = fm.title.trim()
    const seen = new Set<string>()
    for (const tag of [...coerceStringList(fm.tags), ...coerceStringList(fm.aliases)]) {
      const clean = tag.trim()
      if (clean !== '' && !seen.has(clean)) {
        seen.add(clean)
        tags.push(clean)
      }
    }
    if (typeof fm.type === 'string') {
      const mapped = VAULT_TYPE_MAP[fm.type.trim().toLowerCase()]
      if (mapped) {
        type = mapped
      } else {
        warnings.push(`${path}: unknown type "${fm.type}" — imported as concept`)
      }
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

  const bodyTags = extractHashtags(body)
  const seenTags = new Set(tags)
  for (const tag of bodyTags) {
    if (!seenTags.has(tag)) {
      seenTags.add(tag)
      tags.push(tag)
    }
  }

  return { id, name, type, description, content: body.trim(), tags, createdAt, updatedAt: nowIso }
}

/** Normalizes `./x.md` / `../d/y.md` against the importing file's directory. */
const resolveRelativePath = (fromDir: string, target: string): string | null => {
  const clean = target.split('#')[0] ?? ''
  if (clean === '') return null
  const segments = [...fromDir === '' ? [] : fromDir.split('/'), ...clean.split('/')]
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (resolved.length === 0) return null // escapes the vault root
      resolved.pop()
      continue
    }
    resolved.push(segment)
  }
  return resolved.join('/')
}

/** Lookup index over one import batch for the link-resolution pass. */
export interface VaultLinkIndex {
  byId: Map<string, VaultEntityDraft>
  drafts: VaultEntityDraft[]
}

/** Builds the name/tag/id index used to resolve links across the batch. */
export const buildVaultLinkIndex = (drafts: VaultEntityDraft[]): VaultLinkIndex => ({
  byId: new Map(drafts.map((d) => [d.id, d])),
  drafts,
})

/**
 * Converts `[[Wikilinks]]` and relative `.md` links in one body to canonical
 * mention tokens. Names nothing matches are collected (not linked) so the
 * caller can mint stubs for them.
 */
export const convertVaultLinks = (
  content: string,
  fileDir: string,
  index: VaultLinkIndex,
  unresolved: Map<string, string>,
): string => {
  const entities = index.drafts as Entity[]
  let text = content
  // Pass A: [[Name]] / [[path/Name]] / [[Name|display]] — basename fallback
  // covers Obsidian's folder-qualified links without a path index.
  const wikilinks = findWikilinkTokens(text)
  for (const token of [...wikilinks].sort((a, b) => b.start - a.start)) {
    const candidates = token.name.includes('/')
      ? [token.name, token.name.split('/').pop() ?? token.name]
      : [token.name]
    let targetId: string | undefined
    for (const candidate of candidates) {
      targetId = resolveWikilinkTarget(candidate, entities)
      if (targetId !== undefined) break
    }
    if (targetId === undefined) {
      const key = token.name.toLowerCase()
      if (!unresolved.has(key)) unresolved.set(key, token.name)
      continue
    }
    const target = index.byId.get(targetId)
    const display = token.display ?? target?.name ?? token.name
    text = text.slice(0, token.start) + buildMentionToken(targetId, display) + text.slice(token.end)
  }
  // Pass B: relative .md links [text](./other.md) — resolved by vault path.
  RELATIVE_LINK_PATTERN.lastIndex = 0
  const matches = Array.from(text.matchAll(RELATIVE_LINK_PATTERN))
  for (const match of matches.reverse()) {
    const start = match.index ?? 0
    if (text[start - 1] === '!') continue // images stay literal
    const target = match[2] ?? ''
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) continue // absolute URLs stay literal
    let decoded = target
    try {
      decoded = decodeURIComponent(target)
    } catch {
      decoded = target // malformed escapes: match the raw text instead
    }
    if (!isMarkdownPath(decoded.split('#')[0] ?? '')) continue
    const resolved = resolveRelativePath(fileDir, decoded)
    const draft = resolved === null ? undefined : index.byId.get(stripMarkdownExtension(resolved))
    const fallbackName = stripMarkdownExtension(decoded.split('/').pop() ?? decoded).split('#')[0] ?? decoded
    const fallbackId = resolveWikilinkTarget(fallbackName, entities)
    const finalId = draft?.id ?? fallbackId
    if (finalId === undefined) {
      const key = fallbackName.toLowerCase()
      if (!unresolved.has(key)) unresolved.set(key, fallbackName)
      continue
    }
    const display = (match[1] ?? '').trim() === '' ? (index.byId.get(finalId)?.name ?? fallbackName) : (match[1] ?? fallbackName)
    text = text.slice(0, start) + buildMentionToken(finalId, display) + text.slice(start + match[0].length)
  }
  return text
}

/**
 * Parses a vault batch (path → content) into entities + claims with resolved
 * links, stub entities for unresolvable names, and conflict/warning lists.
 */
export const parseVaultFiles = (files: Map<string, string>): MarkdownImportResult => {
  const limitError = checkVaultLimits(files)
  if (limitError !== null) return { success: false, error: limitError }

  const nowIso = new Date().toISOString()
  const warnings: string[] = []
  const drafts: VaultEntityDraft[] = []
  for (const [path, content] of files) {
    if (/^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)) {
      warnings.push(`${path}: not a vault-relative path — file skipped`)
      continue
    }
    const draft = parseVaultFile(path, content, nowIso, warnings)
    if (draft) drafts.push(draft)
  }
  if (drafts.length === 0) {
    return { success: false, error: `No importable notes found. ${warnings.join('; ')}`.trim() }
  }

  const index = buildVaultLinkIndex(drafts)
  const unresolved = new Map<string, string>()
  const linkedDrafts: VaultEntityDraft[] = drafts.map((draft) => {
    const dir = draft.id.includes('/') ? draft.id.slice(0, draft.id.lastIndexOf('/')) : ''
    return { ...draft, content: convertVaultLinks(draft.content, dir, index, unresolved) }
  })
  const linkedById = new Map(linkedDrafts.map((d) => [d.id, d]))

  // Stubs in first-appearance order; a name that also matches an entity id
  // created above resolves instead of minting a duplicate.
  const stubNames: string[] = []
  const stubEntities: Entity[] = []
  for (const name of unresolved.values()) {
    const already = linkedDrafts.find(
      (d) => d.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (already) continue
    stubNames.push(name)
    stubEntities.push({
      id: crypto.randomUUID(),
      name,
      type: 'concept',
      description: '',
      content: '',
      tags: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      links: [],
    })
  }

  // Same name on several ids is a conflict to surface, not a merge: ids come
  // from distinct paths, so collapsing them would destroy notes.
  const nameToIds = new Map<string, string[]>()
  for (const draft of linkedDrafts) {
    const key = draft.name.trim().toLowerCase()
    const list = nameToIds.get(key) ?? []
    list.push(draft.id)
    nameToIds.set(key, list)
  }
  const conflicts = [...nameToIds.entries()]
    .filter(([, ids]) => new Set(ids).size > 1)
    .map(([name]) => linkedById.get(nameToIds.get(name)?.[0] ?? '')?.name ?? name)

  const entities: Entity[] = [...linkedDrafts, ...stubEntities].map((draft) => ({
    id: draft.id,
    name: draft.name,
    type: draft.type,
    description: draft.description,
    content: draft.content,
    tags: draft.tags,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    links: [],
  }))

  const claims: Claim[] = []
  for (const draft of linkedDrafts) {
    for (const claimed of extractClaimsFromText(draft.content)) {
      claims.push({
        id: crypto.randomUUID(),
        entityId: draft.id,
        statement: claimed.statement,
        confidence: 1,
        verification: 'unverified',
        source: claimed.source,
        createdAt: nowIso,
        updatedAt: nowIso,
        version: 1,
        editHistory: [],
      })
    }
  }

  return { success: true, entities, claims, stubNames, conflicts, warnings }
}
