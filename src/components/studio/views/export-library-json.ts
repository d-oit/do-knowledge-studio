import { toast } from 'sonner'
import { buildJsonExport } from './export-helpers'
import { todayStamp, downloadFile, type LibraryPayload } from './export-types'

/** Builds a human-readable summary of the records included in a JSON backup. */
export const buildExportSummary = (payload: LibraryPayload): string => {
  const parts = [`${payload.entities.length} entities`, `${payload.claims.length} claims`]
  if (payload.graph?.nodes?.length) parts.push(`${payload.graph.nodes.length} graph nodes`)
  if (payload.mindMap?.nodes?.length) parts.push(`${payload.mindMap.nodes.length} mind map nodes`)
  if (payload.links?.length) parts.push(`${payload.links.length} links`)
  if (payload.tags?.length) parts.push(`${payload.tags.length} tags`)
  return parts.join(' · ')
}

/**
 * Builds and downloads the JSON backup for a library payload.
 * This is shared by the export view and the command palette so both entry
 * points use the same serializer, filename, and success toast (Plan 049 N4).
 */
export const exportLibraryJson = (payload: LibraryPayload): void => {
  const content = buildJsonExport(payload.entities, payload.claims, {
    graph: payload.graph,
    mindMap: payload.mindMap,
    links: payload.links,
    tags: payload.tags,
  })
  downloadFile(`do-knowledge-studio-export-${todayStamp()}.json`, content, 'application/json')
  toast.success('JSON export downloaded', {
    description: buildExportSummary(payload),
  })
}
