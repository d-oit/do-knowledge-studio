/**
 * Reads an exported OKF bundle (zip file or directory) into concepts.
 *
 * The parsing semantics mirror `src/lib/okf/import.ts` (`parseOkfBundle` /
 * `parseClaims`) without importing app code: reserved `index.md` (which must
 * declare `okf_version 0.2.x`) and `log.md` are skipped, `# Claims` list
 * items join back to frontmatter `sources[]` through `[^id]` footnotes, and
 * verification derives from the concept's `verified` frontmatter. Any change
 * to the OKF export shape must update both this reader and its fixtures.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import yaml from 'yaml'

/** Largest accepted bundle zip (mirrors the vault-zip compressed cap). */
const MAX_BUNDLE_ZIP_BYTES = 10_485_760
/** Largest accepted decompressed total (mirrors the vault-zip safety cap). */
const MAX_BUNDLE_UNCOMPRESSED_BYTES = 52_428_800
/** Largest accepted entry count (mirrors the vault-zip entry cap). */
const MAX_BUNDLE_ENTRIES = 2_000
/** Largest accepted single concept file (fail-closed before parsing). */
const MAX_CONCEPT_BYTES = 5_242_880
/** Zip prefix used by the studio OKF export; stripped to bundle paths. */
const EXPORT_PREFIX = 'okf-bundle/'
/** OKF bundle format versions this server understands. */
const SUPPORTED_OKF_MAJOR = '0.2'

/** Provenance source entry from concept frontmatter. */
export interface BundleSource {
  /** Stable join key for `[^id]` footnote attribution. */
  id?: string
  /** REQUIRED within an entry: the cited resource. */
  resource: string
  /** Human-readable title or evidence label. */
  title?: string
  /** Actor convention `human:<id>` | `process:<id>` | `<producer>/<version>`. */
  author?: string
}

/** Actor event from concept frontmatter (`generated` / `verified`). */
export interface BundleActorEvent {
  by: string
  at?: string
}

/** Trust tier derived from frontmatter `verified` (mirrors trustTier). */
export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed'

/** A claim recovered from a concept's `# Claims` list. */
export interface BundleClaim {
  /** The claim statement text. */
  statement: string
  /** Derived from the concept's trust tier, never upgraded. */
  verification: 'verified' | 'unverified'
  /** Source resource joined through the footnote label, when present. */
  source?: string
  /** Source title joined through the footnote label, when present. */
  evidence?: string
}

/** A parsed bundle concept. */
export interface BundleConcept {
  /** Concept id: bundle-relative path minus `.md`. */
  id: string
  /** Human-readable title or evidence label. */
  name: string
  /** OKF concept type string (e.g. `Note`, `Concept`). */
  type: string
  /** One-line summary of the item. */
  description: string
  /** Markdown body without the `# Claims` / `# Related` sections. */
  content: string
  /** Optional tags payload. */
  tags: string[]
  /** Concept trust tier from frontmatter `verified`. */
  trustTier: TrustTier
  /** Provenance source entries. */
  sources: BundleSource[]
  /** Claims recovered from the `# Claims` list. */
  claims: BundleClaim[]
  /** Related-concept links (`# Related` section): target bundle ids. */
  relatedIds: string[]
}

/** A loaded bundle: concepts plus non-fatal warnings. */
export interface LoadedBundle {
  /** Parsed concepts in bundle order. */
  concepts: BundleConcept[]
  /** Non-fatal notes (skipped entries, unknown keys are tolerated). */
  warnings: string[]
}

/**
 * Derives the trust tier from frontmatter `verified` (mirrors trustTier).
 * @param verified - Raw verified value (single entry or list).
 * @returns The tier; anything without a human verifier stays below reviewed.
 */
export const deriveTrustTier = (verified: unknown): TrustTier => {
  if (!verified) return 'unverified'
  const list = (Array.isArray(verified) ? verified : [verified]) as Array<{ by?: unknown }>
  // Non-object entries are schema-invalid; they verify nothing and must not
  // crash the `by` access or masquerade as machine confirmation.
  const events = list.filter((v) => typeof v === 'object' && v !== null)
  if (events.length === 0) return 'unverified'
  if (events.some((v) => typeof v.by === 'string' && v.by.startsWith('human:'))) {
    return 'human-reviewed'
  }
  return 'machine-confirmed'
}

/**
 * Parses frontmatter into a loose record; unknown keys are preserved and
 * ignored rather than failing the concept (OKF §4.1 extension tolerance).
 * @param text - Full concept file content.
 * @returns The frontmatter record and the remaining body, or null without it.
 */
const splitFrontmatter = (text: string): { fm: Record<string, unknown>; body: string } | null => {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
  if (!match) return null
  let fm: unknown
  try {
    fm = yaml.parse(match[1] ?? '')
  } catch {
    return null
  }
  if (typeof fm !== 'object' || fm === null) return null
  return { fm: fm as Record<string, unknown>, body: match[2] ?? '' }
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
  for (const m of body.matchAll(/^- ([^\n]+?)(?:\[\^([\w-]+)\])?$/gm)) {
    const text = (m[1] ?? '').trim()
    if (text.startsWith('[^') || text.includes('Related') || text.includes('# Claims')) {
      continue
    }
    const source = m[2] ? sourceById.get(m[2]) : undefined
    const claim: BundleClaim = {
      statement: text,
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
  const section = /# Related\n([\s\S]*?)(?:\n# |$)/.exec(body)
  const block = section?.[1] ?? ''
  const ids: string[] = []
  for (const m of block.matchAll(/\[[^\]]*\]\(\/([^)]+?)(?:\.md)?\)/g)) {
    const target = (m[1] ?? '').replace(/\.md$/, '')
    if (target && !ids.includes(target)) ids.push(target)
  }
  return ids
}

/**
 * Strips the `# Claims` and `# Related` sections from display content.
 * @param body - Concept markdown body.
 * @returns The body without machine sections.
 */
const stripMachineSections = (body: string): string =>
  body
    // `(?:^|\n)` keeps a section heading that opens the body strippable too.
    .replace(/(?:^|\n)# Claims\n[\s\S]*?(?=\n# |$)/, '')
    .replace(/(?:^|\n)# Related\n[\s\S]*?(?=\n# |$)/, '')
    .trim()

/**
 * Parses one concept file into a BundleConcept.
 * @param path - Bundle-relative path (id is the path minus `.md`).
 * @param content - Raw file content.
 * @returns The concept, or null when the file is not a valid concept.
 */
const parseConcept = (path: string, content: string): BundleConcept | null => {
  const split = splitFrontmatter(content)
  if (!split) return null
  const { fm, body } = split
  const fileName = path.split('/').pop() ?? path
  const sources = asSources(fm.sources)
  const tier = deriveTrustTier(fm.verified)
  const name = asString(fm.title, fileName.replace(/\.md$/, ''))
  return {
    id: path.replace(/\.md$/, ''),
    name,
    type: asString(fm.type, 'Concept'),
    description: asString(fm.description, ''),
    content: stripMachineSections(body),
    tags: asStringArray(fm.tags),
    trustTier: tier,
    sources,
    claims: parseClaims(body, sources, tier === 'human-reviewed'),
    relatedIds: parseRelatedIds(body),
  }
}

/**
 * Rejects paths that escape the bundle namespace (mirrors the app importer).
 * @param path - Candidate bundle-relative path.
 * @returns True when the path is safe to consume.
 */
const isSafePath = (path: string): boolean => {
  if (!path || path.includes('\0')) return false
  if (/^[A-Za-z]:[\\/]/.test(path) || /^[\\/]/.test(path)) return false
  if (path.split('/').includes('..')) return false
  return true
}

/** Declared `okf_version` from an index file, or null when absent. */
const parseIndexVersion = (content: string): string | null => {
  const m = /okf_version:\s*['"]?([\w.]+)['"]?/.exec(content)
  return m?.[1] ?? null
}

/**
 * Loads concept files from a zip buffer with vault-zip-style guards.
 * @param buffer - Raw zip bytes.
 * @returns Bundle-relative path → content map.
 */
const readZipEntries = (buffer: Buffer): Map<string, string> => {
  if (buffer.byteLength > MAX_BUNDLE_ZIP_BYTES) {
    throw new Error(`Bundle zip is too large; limited to ${MAX_BUNDLE_ZIP_BYTES} bytes compressed.`)
  }
  const entries = unzipSync(new Uint8Array(buffer))
  const names = Object.keys(entries)
  if (names.length > MAX_BUNDLE_ENTRIES) {
    throw new Error(`Too many entries in the bundle; limited to ${MAX_BUNDLE_ENTRIES} files.`)
  }
  const files = new Map<string, string>()
  let total = 0
  for (const [name, bytes] of Object.entries(entries)) {
    if (name.endsWith('/')) continue
    total += bytes.byteLength
    if (bytes.byteLength > MAX_CONCEPT_BYTES || total > MAX_BUNDLE_UNCOMPRESSED_BYTES) {
      throw new Error('Decompressed bundle exceeds the safety limit; refusing to serve.')
    }
    const stripped = name.startsWith(EXPORT_PREFIX) ? name.slice(EXPORT_PREFIX.length) : name
    if (!stripped || !isSafePath(stripped)) continue
    if (!stripped.endsWith('.md')) continue
    files.set(stripped, Buffer.from(bytes).toString('utf8'))
  }
  return files
}

/**
 * Loads concept files from a directory, recursively.
 * @param dir - Bundle directory path.
 * @returns Bundle-relative path → content map.
 */
const readDirectoryEntries = (dir: string): Map<string, string> => {
  const files = new Map<string, string>()
  let total = 0
  const walk = (current: string, prefix: string): void => {
    const names = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
    for (const entry of names) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (!isSafePath(rel)) continue
      if (entry.isDirectory()) {
        walk(join(current, entry.name), rel)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(join(current, entry.name), 'utf8')
        total += content.length
        if (content.length > MAX_CONCEPT_BYTES || total > MAX_BUNDLE_UNCOMPRESSED_BYTES) {
          throw new Error('Bundle exceeds the safety limit; refusing to serve.')
        }
        if (files.size >= MAX_BUNDLE_ENTRIES) {
          throw new Error(`Too many files in the bundle; limited to ${MAX_BUNDLE_ENTRIES}.`)
        }
        files.set(rel, content)
      }
    }
  }
  walk(dir, '')
  return files
}

/**
 * Loads and parses a bundle from a zip file or a directory.
 * Fail-closed: unreadable input, missing/incompatible index, or guard
 * violations throw before any concept is served.
 * @param target - Path to a `.zip` bundle or a directory of `.md` files.
 * @returns The loaded concepts plus non-fatal warnings.
 */
export const loadBundle = (target: string): LoadedBundle => {
  const stat = statSync(target)
  const files = stat.isDirectory()
    ? readDirectoryEntries(target)
    : readZipEntries(readFileSync(target))

  const indexEntry = [...files.keys()].find((p) => /(^|\/)index\.md$/.test(p))
  const declared = indexEntry ? parseIndexVersion(files.get(indexEntry) ?? '') : null
  if (!declared) {
    throw new Error('Not a valid OKF bundle: index.md with okf_version is required.')
  }
  if (declared !== SUPPORTED_OKF_MAJOR && !declared.startsWith(`${SUPPORTED_OKF_MAJOR}.`)) {
    throw new Error(`Unsupported okf_version "${declared}" (expected ${SUPPORTED_OKF_MAJOR}.x).`)
  }

  const concepts: BundleConcept[] = []
  const warnings: string[] = []
  for (const [path, content] of files) {
    if (/(^|\/)index\.md$/.test(path) || /(^|\/)log\.md$/.test(path)) continue
    // Oversize files already threw inside the reader (fail-closed); only
    // frontmatter-less files degrade to warnings here.
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
