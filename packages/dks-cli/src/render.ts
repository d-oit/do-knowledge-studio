/**
 * Human (text) rendering of command payloads. Pure string builders — the
 * runner decides where bytes go (stdout for data, stderr for diagnostics).
 */

import type { SearchResult } from 'dks-core'
import { renderHelp, type HelpData } from './commands/help.js'
import type { DoctorData } from './commands/doctor.js'
import type { AliasesData, ClaimsData, EntityData, IndexData, RelationsData, SearchData } from './commands/queries.js'
import type { GraphNeighborsData, GraphPathData, GraphStatsData } from './commands/graph.js'
import type { BackupVerifyData } from './commands/backup.js'
import type { SkillsCommandData, SkillsData } from './commands/skills.js'
import type { ExportData } from './commands/export-cmd.js'
import type { VersionData } from './commands/version.js'

const UNKNOWN_NAME = '?'
const scoreLabel = (score: number): string => score.toFixed(3)

const resultLines = (results: readonly SearchResult[]): string[] => results.map((hit, position) => {
  const rank = `${position + 1}.`
  const score = `[${scoreLabel(hit.score)}]`
  const where = hit.type === 'claim' ? `claim in ${hit.entityName ?? UNKNOWN_NAME} (${hit.entityId ?? UNKNOWN_NAME})` : hit.id
  return `${rank} ${score} ${hit.name} — ${where}\n    ${hit.snippet}`
})

const claimsLines = (claims: readonly { statement: string; verification: string; source?: string; evidence?: string }[]): string[] =>
  claims.map((claim) => {
    const source = claim.source !== undefined ? ` — ${claim.source}` : ''
    return `  - [${claim.verification}] ${claim.statement}${source}`
  })

const relatedLines = (related: readonly { id: string; name: string | null }[]): string[] =>
  related.map((entry) => `  - ${entry.id}${entry.name === null ? ' (missing)' : ` — ${entry.name}`}`)

export type CommandPayload =
  | HelpData
  | DoctorData
  | SearchData
  | EntityData
  | ClaimsData
  | AliasesData
  | RelationsData
  | IndexData
  | GraphNeighborsData
  | GraphPathData
  | GraphStatsData
  | BackupVerifyData
  | SkillsCommandData
  | ExportData
  | VersionData

const renderSearch = (data: SearchData): string[] => [
  `search: "${data.query}" — ${data.results.length} hit(s) (limit ${data.limit})`,
  ...resultLines(data.results),
]

const renderEntity = (data: EntityData): string[] => {
  const lines = [
    `${data.id} — ${data.name} [${data.type}] trust: ${data.trustTier}`,
    `description: ${data.description}`,
    `tags: ${data.tags.join(', ') || '(none)'}`,
  ]
  if (data.aliases.length > 0) lines.push(`aliases: ${data.aliases.join(', ')}`)
  lines.push(`claims (${data.claims.length}):`, ...claimsLines(data.claims))
  lines.push(`related (${data.related.length}):`, ...relatedLines(data.related))
  return lines
}

const renderDoctor = (data: DoctorData): string[] => {
  const lines = [
    `bundle: ${data.bundle.path} (${data.bundle.kind})`,
    `okf_version: ${data.bundle.declaredOkfVersion ?? 'declared inside archive'} (supported major ${data.bundle.supportedOkfVersion}, loader-enforced)`,
    `counts: entities=${data.counts.entities} claims=${data.counts.claims} warnings=${data.counts.warnings}`,
    'checks:',
    ...data.checks.map((check) => `  [${check.ok ? 'ok' : 'FAIL'}] ${check.id}: ${check.detail}`),
  ]
  if (data.warnings.length > 0) {
    lines.push('warnings:', ...data.warnings.map((warning) => `  - ${warning}`))
  }
  lines.push(
    `engine: node ${data.engine.node} · Intl.Segmenter ${data.engine.intlSegmenter ? 'available' : 'unavailable'}`,
    `healthy: ${data.healthy ? 'yes' : 'no'}`,
  )
  return lines
}

const renderNeighbors = (data: GraphNeighborsData): string[] => [
  `neighbors of ${data.root} within depth ${data.depth}: ${data.nodes.length} node(s), ${data.edges.length} edge(s)`,
  ...data.nodes.map((node) => `  ${'  '.repeat(node.depth)}- [${node.depth}] ${node.id} — ${node.name}`),
  ...data.edges.map((edge) => `  edge: ${edge.source} ↔ ${edge.target}${edge.relation === '' ? '' : ` (${edge.relation})`}`),
]

const renderPath = (data: GraphPathData): string[] => [
  `path ${data.from} → ${data.to}: ${data.nodes.length} node(s), ${data.hops.length} hop(s)`,
  `  ${data.nodes.map((node) => node.name).join(' → ')}`,
  ...data.hops.map((hop, index) => `  ${index + 1}. ${hop.from} → ${hop.to}${hop.relation === '' ? '' : ` (${hop.relation})`}`),
]

const renderStats = (data: GraphStatsData): string[] => [
  `nodes: ${data.nodes}`,
  `edges (undirected): ${data.edges}`,
  'types:',
  ...data.types.map((entry) => `  - ${entry.type}: ${entry.count}`),
  `orphans: ${data.orphans}`,
  ...data.orphanIds.map((id) => `  orphan: ${id}`),
]

const renderSkillsList = (data: SkillsCommandData & { skills: { name: string; hasSkillMd: boolean }[]; results?: undefined }): string[] => [
  `skills dir: ${data.skillsDir}`,
  ...data.skills.map((skill) => `  ${skill.name}${skill.hasSkillMd ? '' : '  (no SKILL.md)'}`),
  `${data.skills.length} skill(s)`,
]

const renderSkills = (data: SkillsCommandData): string[] => {
  if ('skills' in data && !('results' in data)) {
    return renderSkillsList(data as SkillsCommandData & { skills: { name: string; hasSkillMd: boolean }[]; results?: undefined })
  }
  const report = data as SkillsData
  return [
    `skills dir: ${report.skillsDir}`,
    ...report.results.map((entry) => entry.findings.length === 0
      ? `  ok        ${entry.name}`
      : `  invalid   ${entry.name}\n${entry.findings.map((finding) => `      - ${finding}`).join('\n')}`),
    `summary: ${report.healthy}/${report.checked} healthy, ${report.failed} failed`,
  ]
}

const renderBackup = (data: BackupVerifyData): string[] => [
  `archive: ${data.archive}`,
  `verified: ${data.verified ? 'yes' : 'no'}`,
  `format: ${data.summary.formatVersion} (schema ${data.summary.schemaVersion}, app ${data.summary.appVersion})`,
  `exported: ${data.summary.exportedAt}`,
  `encryption: ${data.summary.encrypted ? 'AES-256-GCM' : 'none'}`,
  `records: entities=${data.summary.entityCount} claims=${data.summary.claimCount} graphEdges=${data.summary.graphEdgeCount} mindMapEdges=${data.summary.mindMapEdgeCount} links=${data.summary.linkCount} tags=${data.summary.tagCount} graphViews=${data.summary.graphViewCount}`,
]

const renderExport = (data: ExportData): string[] =>
  'rendered' in data ? [data.rendered] : ['files:', ...data.files.map((file) => `  ${file.path} (${file.content.length} chars)`)]

const renderOwnData = (payload: CommandPayload, command: string): string[] => {
  switch (command) {
    case 'help':
      // Both modes derive from the single source in commands/help.ts.
      return [renderHelp(payload as HelpData)]
    case 'version': {
      const version = payload as VersionData
      return [`${version.name} ${version.version} (node ${version.node})`]
    }
    case 'doctor': return renderDoctor(payload as DoctorData)
    case 'search': return renderSearch(payload as SearchData)
    case 'entity': return renderEntity(payload as EntityData)
    case 'claims': {
      const claims = payload as ClaimsData
      return [`claims of ${claims.id} (${claims.claims.length}):`, ...claimsLines(claims.claims)]
    }
    case 'aliases': {
      const aliases = payload as AliasesData
      return [`aliases of ${aliases.id}: ${aliases.aliases.length > 0 ? aliases.aliases.join(', ') : '(none)'}`]
    }
    case 'relations': {
      const relations = payload as RelationsData
      return [`relations of ${relations.id}:`, ...relatedLines(relations.related)]
    }
    case 'index': {
      const index = payload as IndexData
      return [
        `entities (${index.shown} shown of ${index.total}):`,
        ...index.items.map((entry) => `  ${entry.id} — ${entry.name}`),
      ]
    }
    case 'graph': {
      const graph = payload as GraphNeighborsData | GraphPathData | GraphStatsData
      if ('root' in graph) return renderNeighbors(graph)
      if ('from' in graph) return renderPath(graph)
      return renderStats(graph)
    }
    case 'backup': return renderBackup(payload as BackupVerifyData)
    case 'skills': return renderSkills(payload as SkillsData)
    case 'export': return renderExport(payload as ExportData)
    default: return [`(no text renderer for "${command}")`]
  }
}

/** Full text rendering for an ok envelope (without trailing newline). */
export const renderPayloadText = (command: string, payload: CommandPayload): string =>
  renderOwnData(payload, command).join('\n')

/** stderr diagnostic rendering for text mode (no trailing newline). */
export const renderErrorText = (command: string, message: string, hint: string | undefined): string => {
  const lines = [`dks ${command || '(no command)'}: ${message}`]
  if (hint !== undefined) lines.push(`hint: ${hint}`)
  return lines.join('\n')
}
