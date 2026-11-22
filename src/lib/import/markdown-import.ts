/**
 * Markdown / Obsidian-vault import (issue #1054) — thin adapter over the
 * shared `dks-core` Markdown import service.
 *
 * All batch limits, path guards, frontmatter validation/mapping, tag
 * extraction, and link-span scanning live in
 * `packages/dks-core/src/markdown.ts` (`parseMarkdownImport`). This file
 * keeps only the PWA-specific presentation layer: mention-token rendering
 * (editor tokens), vault-relative link resolution, claim extraction from
 * text, and UUID stub minting. Public behavior is unchanged.
 */

import type { Entity, Claim } from '@/lib/studio/types'
import { buildMentionToken } from '@/lib/editor/mention'
import { resolveWikilinkTarget } from '@/lib/editor/wikilinks'
import { extractClaimsFromText } from '@/lib/studio/claim-parser'
import {
  checkVaultLimits as coreCheckVaultLimits,
  isMarkdownPath,
  parseMarkdownImport,
  scanMarkdownLinks,
  stripMarkdownExtension,
  type MarkdownLinkSpans,
} from 'dks-core/markdown'
export {
  MAX_MARKDOWN_FILES,
  MAX_MARKDOWN_FILE_BYTES,
  MAX_MARKDOWN_TOTAL_BYTES,
  MARKDOWN_EXTENSIONS,
} from 'dks-core/markdown'

/** Strips a Markdown extension from a vault path (shared helper). */
export { stripMarkdownExtension } from 'dks-core/markdown'
/** True when the path points at an importable note file (shared helper). */
export { isMarkdownPath } from 'dks-core/markdown'
/** Splits raw content into frontmatter + body (shared helper). */
export { splitFrontmatter } from 'dks-core/frontmatter'


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
  aliases?: string[]
  createdAt: string
  updatedAt: string
  linkSpans?: MarkdownLinkSpans
}

/**
 * Fails closed on batch limits before any parsing happens (shared service).
 * @param files - Vault-relative path → raw content.
 * @returns An error message, or null when the batch is within limits.
 */
export const checkVaultLimits = (files: Map<string, string>): string | null =>
  coreCheckVaultLimits(files)

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
 * Converts shared Markdown link spans to canonical mention tokens (PWA
 * presentation). Unresolved names remain plain text and are collected for
 * stub creation by the caller.
 */
export const convertVaultLinks = (
  content: string,
  fileDir: string,
  index: VaultLinkIndex,
  unresolved: Map<string, string>,
  linkSpans: MarkdownLinkSpans = scanMarkdownLinks(content),
): string => {
  const entities = index.drafts as Entity[]
  let text = content
  let wikiIndex = linkSpans.wikilinks.length - 1
  let relativeIndex = linkSpans.relativeLinks.length - 1
  while (wikiIndex >= 0 || relativeIndex >= 0) {
    const wiki = wikiIndex >= 0 ? linkSpans.wikilinks[wikiIndex] : undefined
    const relative = relativeIndex >= 0 ? linkSpans.relativeLinks[relativeIndex] : undefined
    if (relative === undefined || (wiki !== undefined && wiki.start > relative.start)) {
      wikiIndex -= 1
      if (!wiki) continue
      const candidates = wiki.name.includes('/')
        ? [wiki.name, wiki.name.split('/').pop() ?? wiki.name]
        : [wiki.name]
      let targetId: string | undefined
      for (const candidate of candidates) {
        targetId = resolveWikilinkTarget(candidate, entities)
        if (targetId !== undefined) break
      }
      if (targetId === undefined) {
        const key = wiki.name.toLowerCase()
        if (!unresolved.has(key)) unresolved.set(key, wiki.name)
        continue
      }
      const target = index.byId.get(targetId)
      const display = wiki.display ?? target?.name ?? wiki.name
      text = text.slice(0, wiki.start) + buildMentionToken(targetId, display) + text.slice(wiki.end)
      continue
    }

    relativeIndex -= 1
    if (!relative || !isMarkdownPath(relative.target)) continue
    const resolved = resolveRelativePath(fileDir, relative.target)
    const draft = resolved === null ? undefined : index.byId.get(stripMarkdownExtension(resolved))
    const fallbackName = stripMarkdownExtension(relative.target.split('/').pop() ?? relative.target)
    const fallbackId = resolveWikilinkTarget(fallbackName, entities)
    const finalId = draft?.id ?? fallbackId
    if (finalId === undefined) {
      const key = fallbackName.toLowerCase()
      if (!unresolved.has(key)) unresolved.set(key, fallbackName)
      continue
    }
    const display = relative.text.trim() === ''
      ? (index.byId.get(finalId)?.name ?? fallbackName)
      : relative.text
    text = text.slice(0, relative.start) + buildMentionToken(finalId, display) + text.slice(relative.end)
  }
  return text
}

/**
 * Parses a vault batch (path → content) into entities + claims with resolved
 * links, stub entities for unresolvable names, and conflict/warning lists.
 * Validation/parsing runs in the shared `dks-core` service; this adapter
 * supplies the PWA presentation layer.
 */
export const parseVaultFiles = (files: Map<string, string>): MarkdownImportResult => {
  const service = parseMarkdownImport(files)
  if (!service.success) return { success: false, error: service.error }
  const warnings = service.warnings
  const nowIso = new Date().toISOString()

  const drafts: VaultEntityDraft[] = service.drafts.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type as Entity['type'],
    description: d.description,
    content: d.content,
    tags: [...new Set([...d.frontmatterTags, ...(d.aliases ?? []), ...d.bodyTags])],
    ...(d.aliases !== undefined ? { aliases: d.aliases } : {}),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    linkSpans: d,
  }))
  if (drafts.length === 0) {
    return { success: false, error: `No importable notes found. ${warnings.join('; ')}`.trim() }
  }

  const index = buildVaultLinkIndex(drafts)
  const unresolved = new Map<string, string>()
  const linkedDrafts: VaultEntityDraft[] = drafts.map((draft) => {
    const dir = draft.id.includes('/') ? draft.id.slice(0, draft.id.lastIndexOf('/')) : ''
    return { ...draft, content: convertVaultLinks(draft.content, dir, index, unresolved, draft.linkSpans) }
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
    ...(draft.aliases !== undefined ? { aliases: draft.aliases } : {}),
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
