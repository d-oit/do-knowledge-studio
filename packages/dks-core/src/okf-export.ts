/**
 * OKF v0.2 bundle serialization — single-sourced from the PWA.
 *
 * This module is a framework-neutral port of `src/lib/okf/bundle.ts` (the
 * PWA's OKF exporter) with the studio types replaced by structural inputs.
 * The PWA file re-exports from here, so one implementation produces every
 * OKF bundle: the studio export view and the `dks` CLI. Frontmatter is
 * rendered with `yaml` exactly like the PWA.
 */

import yaml from 'yaml'
import { slug } from './markdown.js'

/** Minimal structural shape of an entity to export (PWA `Entity` satisfies it). */
export interface CoreExportEntity {
  id: string
  name: string
  type: string
  description: string
  content: string
  tags: readonly string[]
}

/** Minimal structural shape of a claim to export (PWA `Claim` satisfies it). */
export interface CoreExportClaim {
  entityId: string
  statement: string
  source?: string
  evidence?: string
  updatedAt?: string
}

/** A typed graph edge exported as a related link (PWA `GraphEdge` satisfies it). */
export interface CoreExportEdge {
  source: string
  target: string
}

/** A bundle file: bundle-relative path plus content. */
export interface OkfBundleFile {
  path: string
  content: string
}

/** An OKF v0.2 bundle: index, log, and concept files. */
export interface OkfBundle {
  files: OkfBundleFile[]
  okfVersion: '0.2'
}

/** §4.1: type values are not centrally registered; pick descriptive strings. */
const OKF_TYPE_MAP: Record<string, string> = {
  note: 'Note',
  concept: 'Concept',
  person: 'Person',
  project: 'Project',
}

/** §3.1: index.md / log.md are reserved and must not be used for concepts. */
const RESERVED = new Set(['index', 'log'])

/** Computes the bundle-relative concept file path for an entity. */
const conceptPath = (e: CoreExportEntity): string => {
  const typeName = OKF_TYPE_MAP[e.type] ?? 'Concept'
  let name = slug(e.name)
  if (RESERVED.has(name)) name = `${name}-concept` // never collide with reserved filenames
  return `${typeName.toLowerCase()}s/${name}.md`
}

/** Ensures a bundle-relative concept path is unique, appending a suffix. */
const uniquePath = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  const stem = base.replace(/\.md$/, '')
  let n = 2
  let candidate = `${stem}-${n}.md`
  while (used.has(candidate)) {
    n += 1
    candidate = `${stem}-${n}.md`
  }
  used.add(candidate)
  return candidate
}

/** §5.1 provenance: a claim source entry with a STABLE id for footnotes. */
interface SourceEntry {
  id: string
  resource: string
  title?: string
  last_modified?: string
}

/** Builds §5.1 provenance entries from claims that carry a source. */
const buildSources = (
  claims: CoreExportClaim[],
): { sources: SourceEntry[]; sourceIdByResource: Map<string, string> } => {
  const sources: SourceEntry[] = []
  const sourceIdByResource = new Map<string, string>()
  for (const c of claims) {
    if (!c.source) continue
    let id = sourceIdByResource.get(c.source)
    if (!id) {
      id = `src-${sources.length + 1}`
      sourceIdByResource.set(c.source, id)
      sources.push({
        id,
        resource: c.source,
        ...(c.evidence !== undefined ? { title: c.evidence } : {}),
        ...(c.updatedAt !== undefined ? { last_modified: c.updatedAt.slice(0, 10) } : {}),
      })
    }
  }
  return { sources, sourceIdByResource }
}

/** Builds the concept body: content, a "# Claims" list, and footnotes. */
const buildConceptBody = (
  e: CoreExportEntity,
  claims: CoreExportClaim[],
  sourceIdByResource: Map<string, string>,
  sources: SourceEntry[],
): string => {
  const lines = [
    e.content,
    claims.length ? '\n# Claims\n' : '',
    ...claims.map((c) => {
      const id = c.source ? sourceIdByResource.get(c.source) : undefined
      return `- ${c.statement}${id ? `[^${id}]` : ''}`
    }),
    claims.length ? '' : '',
    ...sources.map((s) => `[^${s.id}]: ${s.title ?? s.resource}`),
  ]
  return lines.filter((line) => line !== '').join('\n')
}

/** Renders a single concept file (frontmatter + body) per §4.1/§5. */
const buildConceptDoc = (e: CoreExportEntity, claims: CoreExportClaim[], studioVersion: string, now: Date): string => {
  const { sources, sourceIdByResource } = buildSources(claims)
  const frontmatter: Record<string, unknown> = {
    type: OKF_TYPE_MAP[e.type] ?? 'Concept',
    title: e.name,
    description: e.description,
    tags: e.tags,
    status: 'stable',
    generated: { by: `do-knowledge-studio/${studioVersion}`, at: now.toISOString() },
  }
  if (sources.length) {
    frontmatter.sources = sources
  }
  const body = buildConceptBody(e, claims, sourceIdByResource, sources)
  return `---\n${yaml.stringify(frontmatter)}---\n\n${body}\n`
}

/** Renders one index section (e.g. "# Concepts") from its bundle file entries. */
const buildIndexSection = (
  dir: string,
  items: { title: string; href: string; desc: string }[],
): string =>
  [
    `# ${dir.charAt(0).toUpperCase() + dir.slice(1)}`,
    '',
    ...items.map((i) => `* [${i.title}](${i.href}) - ${i.desc}`),
  ].join('\n')

/** Builds the root index.md: §8 allows okf_version frontmatter on the index only. */
const buildIndex = (files: OkfBundleFile[], entityByPath: Map<string, CoreExportEntity>): string => {
  const byDir = new Map<string, { title: string; href: string; desc: string }[]>()
  for (const f of files) {
    if (f.path === 'index.md' || f.path === 'log.md') continue
    const parts = f.path.split('/')
    const dir = parts[0] ?? ''
    const entity = entityByPath.get(f.path)
    const entries = byDir.get(dir) ?? []
    entries.push({
      title: entity?.name ?? f.path,
      href: `/${f.path}`,
      desc: entity?.description ?? '',
    })
    byDir.set(dir, entries)
  }
  const sections = [...byDir.entries()]
    .map(([dir, items]) => buildIndexSection(dir, items))
    .join('\n\n')
  return `---\nokf_version: "0.2"\n---\n\n# Knowledge Bundle\n\n${sections}\n`
}

/** Builds log.md: §9 date headings MUST be ISO YYYY-MM-DD, newest first. */
const buildLog = (now: Date): string => {
  const day = now.toISOString().slice(0, 10)
  return `# Directory Update Log\n\n## ${day}\n* **Export**: Bundle generated by do-knowledge-studio.\n`
}

/** Rewrites edges as bundle-relative markdown links under "# Related". */
const appendRelatedLinks = (
  conceptFiles: OkfBundleFile[],
  edges: CoreExportEdge[],
  entityById: Map<string, CoreExportEntity>,
  pathByEntityId: Map<string, string>,
): void => {
  for (const edge of edges) {
    const from = conceptFiles.find((f) => f.path === pathByEntityId.get(edge.source)?.slice(1))
    const toPath = pathByEntityId.get(edge.target)
    if (from && toPath && !from.content.includes(`](${toPath})`)) {
      from.content = from.content.replace(
        /\n?$/,
        `\n\n# Related\n\n* [${entityById.get(edge.target)?.name ?? toPath}](${toPath})\n`,
      )
    }
  }
}

/**
 * Builds an OKF v0.2 bundle from core entities and claims.
 * @param entities - Entities to export as concept files.
 * @param claims - Claims attributed to entities.
 * @param edges - Graph edges rendered as related links.
 * @param studioVersion - Producer version recorded in generated metadata.
 * @param now - Timestamp for generated/log metadata.
 * @returns The assembled OKF bundle.
 */
export const buildOkfBundle = (
  entities: CoreExportEntity[],
  claims: CoreExportClaim[],
  edges: CoreExportEdge[] = [],
  studioVersion = '0.2.0',
  now: Date = new Date(),
): OkfBundle => {
  const claimsByEntity = new Map<string, CoreExportClaim[]>()
  for (const c of claims) {
    claimsByEntity.set(c.entityId, [...(claimsByEntity.get(c.entityId) ?? []), c])
  }

  const usedPaths = new Set<string>()
  const conceptFiles: OkfBundleFile[] = entities.map((e) => ({
    path: uniquePath(conceptPath(e), usedPaths),
    content: buildConceptDoc(e, claimsByEntity.get(e.id) ?? [], studioVersion, now),
  }))

  const pathByEntityId = new Map(
    entities.map((e, i) => [e.id, `/${conceptFiles.at(i)?.path ?? ''}`]),
  )
  const entityByPath = new Map(entities.map((e, i) => [conceptFiles.at(i)?.path ?? '', e]))
  const entityById = new Map(entities.map((e) => [e.id, e]))
  appendRelatedLinks(conceptFiles, edges, entityById, pathByEntityId)

  const files: OkfBundleFile[] = [{ path: 'log.md', content: buildLog(now) }, ...conceptFiles]
  files.unshift({ path: 'index.md', content: buildIndex(conceptFiles, entityByPath) })
  return { files, okfVersion: '0.2' }
}
