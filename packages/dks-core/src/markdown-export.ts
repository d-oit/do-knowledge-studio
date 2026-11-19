/**
 * Markdown export: serializes core entities into a directory of `.md`
 * files (frontmatter + body + `[[Wikilink]]` related links). This is the
 * inverse of {@link parseMarkdownBundle}: the round trip is stable for the
 * supported field subset.
 */

import { slug } from './markdown.js'
import type { CoreEntity } from './types.js'

/** A markdown export file: vault-relative path plus content. */
export interface MarkdownExportFile {
  path: string
  content: string
}

/** Renders a scalar frontmatter value safely. */
const formatFmValue = (value: string): string => {
  if (/[\n"'#:]|^\s|\s$/.test(value)) {
    return JSON.stringify(value)
  }
  return value
}

/** Renders a list frontmatter value as indented items. */
const formatFmList = (values: string[]): string =>
  values.map((v) => `  - ${formatFmValue(v)}`).join('\n')

/** Serializes one entity into a markdown file. */
const buildNoteDoc = (e: CoreEntity, nameById: Map<string, string>): string => {
  const fmLines: string[] = []
  fmLines.push(`title: ${formatFmValue(e.name)}`)
  fmLines.push(`type: ${formatFmValue(e.type)}`)
  if (e.description !== '') fmLines.push(`description: ${formatFmValue(e.description)}`)
  if (e.tags.length > 0) {
    fmLines.push('tags:')
    fmLines.push(formatFmList(e.tags))
  }
  if (e.aliases && e.aliases.length > 0) {
    fmLines.push('aliases:')
    fmLines.push(formatFmList(e.aliases))
  }
  const body = e.content.trim()
  const related = (e.links ?? [])
    .map((l) => nameById.get(l.targetId) ?? l.targetId)
    .filter((t, i, all) => all.indexOf(t) === i)
  const parts: string[] = []
  if (body !== '') parts.push(body)
  if (related.length > 0) {
    parts.push(related.map((name) => `[[${name}]]`).join(' '))
  }
  return `---\n${fmLines.join('\n')}\n---\n\n${parts.join('\n\n')}\n`
}

/**
 * Exports entities to a markdown file set. Paths are unique slugs under the
 * vault root; duplicate slugs get numeric suffixes.
 * @param entities - Entities to serialize.
 * @returns The markdown files (path → content).
 */
export const buildMarkdownExport = (entities: CoreEntity[]): MarkdownExportFile[] => {
  const used = new Set<string>()
  const files: MarkdownExportFile[] = []
  const nameById = new Map(entities.map((e) => [e.id, e.name]))
  for (const e of entities) {
    const base = `${slug(e.name)}.md`
    let path = base
    let n = 2
    while (used.has(path)) {
      path = base.replace(/\.md$/, `-${n}.md`)
      n += 1
    }
    used.add(path)
    files.push({ path, content: buildNoteDoc(e, nameById) })
  }
  return files
}
