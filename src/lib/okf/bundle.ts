import yaml from 'yaml'
import type { Entity, Claim, GraphEdge } from '@/lib/studio/types'
import type { OkfBundle, OkfBundleFile } from './types'

/** Slugs a concept name into a safe, lowercase, kebab-case file name. */
export const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled'

/** §4.1: type values are not centrally registered; pick descriptive, self-explanatory strings. */
const OKF_TYPE_MAP: Record<string, string> = {
  note: 'Note',
  concept: 'Concept',
  person: 'Person',
  project: 'Project',
}

/** §3.1: index.md / log.md are reserved and MUST NOT be used for concepts. */
const RESERVED = new Set(['index', 'log'])

/** Computes the bundle-relative concept file path for an entity (e.g. `concepts/foo.md`). */
const conceptPath = (e: Entity): string => {
  const typeName = OKF_TYPE_MAP[e.type] ?? 'Concept'
  let name = slug(e.name)
  if (RESERVED.has(name)) name = `${name}-concept` // never collide with reserved filenames
  return `${typeName.toLowerCase()}s/${name}.md`
}

/** §5.1 provenance: a claim source entry with a STABLE id used for footnote attribution. */
interface SourceEntry {
  /** Stable join key referenced by `[^id]` footnote labels in concept bodies. */
  id: string
  /** The original resource URL or identifier. */
  resource: string
  /** Human-readable title or evidence label for the source. */
  title?: string
  /** ISO date the source was last modified, when known. */
  last_modified?: string
}

/**
 * Builds §5.1 provenance entries from claims that carry a source.
 * Sources are de-duplicated by resource and assigned stable `src-N` ids.
 */
const buildSources = (
  claims: Claim[],
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
        title: c.evidence, // mapping evidence as title or keep resource
        last_modified: c.updatedAt?.slice(0, 10),
      })
    }
  }
  return { sources, sourceIdByResource }
}

/**
 * Builds the concept body: content, a "# Claims" list with footnote attribution,
 * and the footnote definitions that join claims back to sources[] (§5.1).
 */
const buildConceptBody = (
  e: Entity,
  claims: Claim[],
  sourceIdByResource: Map<string, string>,
  sources: SourceEntry[],
): string => {
  const lines = [
    e.content ?? '',
    claims.length ? '\n# Claims\n' : '',
    ...claims.map((c) => {
      const id = c.source ? sourceIdByResource.get(c.source) : undefined
      return `- ${c.statement}${id ? `[^${id}]` : ''}`
    }),
    claims.length ? '' : '',
    // §5.1: footnote label is the join key into sources[], NOT positional
    ...sources.map((s) => `[^${s.id}]: ${s.title ?? s.resource}`),
  ]
  return lines.filter((line) => line !== '').join('\n')
}

/** Renders a single concept file (frontmatter + body) per §4.1/§5. */
const buildConceptDoc = (e: Entity, claims: Claim[], studioVersion: string, now: Date): string => {
  const { sources, sourceIdByResource } = buildSources(claims)
  const frontmatter: Record<string, unknown> = {
    type: OKF_TYPE_MAP[e.type] ?? 'Concept',
    title: e.name,
    description: e.description, // adjust to the actual Entity field used for one-line summaries
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

/**
 * Builds the root index.md: §8 allows okf_version frontmatter on the index only.
 * Concept files are grouped by directory with bundle-relative links (§6.1).
 */
const buildIndex = (files: OkfBundleFile[], entities: Entity[]): string => {
  const byDir = new Map<string, { title: string; href: string; desc: string }[]>()
  for (const f of files) {
    if (f.path === 'index.md' || f.path === 'log.md') continue
    const parts = f.path.split('/')
    const dir = parts[0]
    const entity = entities.find((e) => f.path.endsWith(`${slug(e.name)}.md`))
    const entries = byDir.get(dir) ?? []
    entries.push({
      title: entity?.name ?? f.path,
      href: `/${f.path}`, // §6.1: bundle-relative absolute links are the recommended form
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

/**
 * Rewrites GraphEdge relationships as bundle-relative markdown links appended
 * under a "# Related" heading in each linked concept (§6.1; edges are untyped).
 */
const appendRelatedLinks = (
  conceptFiles: OkfBundleFile[],
  edges: GraphEdge[],
  entities: Entity[],
  pathByEntityId: Map<string, string>,
): void => {
  for (const edge of edges) {
    const from = conceptFiles.find((f) => f.path === pathByEntityId.get(edge.source)?.slice(1))
    const toPath = pathByEntityId.get(edge.target)
    if (from && toPath && !from.content.includes(`](${toPath})`)) {
      from.content = from.content.replace(
        /\n?$/,
        `\n\n# Related\n\n* [${entities.find((e) => e.id === edge.target)?.name ?? toPath}](${toPath})\n`,
      )
    }
  }
}

/**
 * Builds an OKF v0.2 bundle from studio state: index.md, log.md, and one
 * concept file per entity, with cross-entity edges rendered as related links.
 */
export const buildOkfBundle = (
  entities: Entity[],
  claims: Claim[],
  edges: GraphEdge[],
  studioVersion: string,
  now: Date = new Date(),
): OkfBundle => {
  const claimsByEntity = new Map<string, Claim[]>()
  for (const c of claims) {
    claimsByEntity.set(c.entityId, [...(claimsByEntity.get(c.entityId) ?? []), c])
  }

  const conceptFiles: OkfBundleFile[] = entities.map((e) => ({
    path: conceptPath(e),
    content: buildConceptDoc(e, claimsByEntity.get(e.id) ?? [], studioVersion, now),
  }))

  const pathByEntityId = new Map(entities.map((e) => [e.id, `/${conceptPath(e)}`]))
  appendRelatedLinks(conceptFiles, edges, entities, pathByEntityId)

  const files: OkfBundleFile[] = [{ path: 'log.md', content: buildLog(now) }, ...conceptFiles]
  files.unshift({ path: 'index.md', content: buildIndex(conceptFiles, entities) })
  return { files, okfVersion: '0.2' }
}
