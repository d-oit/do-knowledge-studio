import type { Entity, Claim } from '@/lib/studio/types'
import { validateImportPayload } from '@/lib/studio/schema'
import { escapeHtml } from '@/lib/security'
import { buildClaimsByEntityId, type ExportOptions, type ImportResult } from './export-types'

/** Builds a JSON export string including graph, mind map, links, and tags. */
export const buildJsonExport = (
  entities: Entity[],
  claims: Claim[],
  options?: ExportOptions,
): string => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    claims,
    ...(options?.graph && { graph: options.graph }),
    ...(options?.mindMap && { mindMap: options.mindMap }),
    ...(options?.links && { links: options.links }),
    ...(options?.tags && { tags: options.tags }),
  }
  return JSON.stringify(payload, null, 2)
}

/** Builds a Markdown export string with every entity and its claims. */
export const buildMarkdownExport = (entities: Entity[], claims: Claim[]): string => {
  const claimsByEntity = buildClaimsByEntityId(claims)
  const parts: string[] = []
  parts.push(`# DO Knowledge Studio — export\n`)
  parts.push(`Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.\n`)
  for (const e of entities) {
    const tags = e.tags.length ? e.tags.map((t) => `#${t}`).join('  ') : '—'
    const created = e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 10) : '—'
    const updated = e.updatedAt ? new Date(e.updatedAt).toISOString().slice(0, 10) : '—'
    const links = e.links.length
      ? e.links.map((l) => `- → ${l.targetId} — ${l.relation}`).join('\n')
      : '—'

    parts.push('\n---\n')
    parts.push(`# ${e.name}\n`)
    parts.push(`**Type:** ${e.type.charAt(0).toUpperCase() + e.type.slice(1)}  `)
    parts.push(`**Tags:** ${tags}  `)
    if (e.sourceUrl) parts.push(`**Source:** ${e.sourceUrl}  `)
    parts.push(`**Created:** ${created}  `)
    parts.push(`**Updated:** ${updated}\n`)
    if (e.description) parts.push(`> ${e.description}\n`)
    parts.push(`\n${e.content || '_(no body content)_'}\n`)
    parts.push(`\n**Links:**\n${links}\n`)

    const entityClaims = claimsByEntity.get(e.id) ?? []
    if (entityClaims.length) {
      parts.push('\n## Claims\n')
      for (const c of entityClaims) {
        const pct = Math.round(c.confidence * 100)
        const src = c.source ? `, source: ${c.source}` : ''
        const ev = c.evidence ? ` — _${c.evidence}_` : ''
        parts.push(
          `- [${c.verification}] ${c.statement} (confidence: ${pct}%${src})${ev}`,
        )
      }
    } else {
      parts.push('\n## Claims\n_(none)_')
    }
    parts.push('')
  }
  return parts.join('\n')
}

/** Builds a self-contained HTML export page (with CSP) for all entities. */
export const buildHtmlExport = (entities: Entity[], claims: Claim[]): string => {
  const claimsByEntity = buildClaimsByEntityId(claims)
  const rows = entities
    .map((e) => {
      const entityClaims = claimsByEntity.get(e.id) ?? []
      const claimsHtml = entityClaims.length
        ? `<ul class="claims">${entityClaims
            .map(
              (c) =>
                `<li><span class="v ${escapeHtml(c.verification)}">${escapeHtml(
                  c.verification,
                )}</span> ${escapeHtml(
                  c.statement,
                )} <span class="meta">(${Math.round(c.confidence * 100)}%)</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="meta">No claims.</p>'
      return `<article>
  <header>
    <span class="type ${escapeHtml(e.type)}">${escapeHtml(e.type)}</span>
    <h2>${escapeHtml(e.name)}</h2>
    <p class="meta">${e.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>
  </header>
  <p class="desc">${escapeHtml(e.description)}</p>
  <pre class="content">${escapeHtml(e.content)}</pre>
  <h3>Claims</h3>
  ${claimsHtml}
</article>`
    })
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none';" />
  <title>DO Knowledge Studio export</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 2rem; color: #1a1814; background: #faf8f3; }
    h1 { font-family: Georgia, serif; }
    article { border-top: 1px solid #e5e1d8; padding: 1.5rem 0; }
    article header h2 { font-family: Georgia, serif; margin: 0.4rem 0; font-size: 1.4rem; }
    .type { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; background: #f5e8d5; color: #8a4f1c; }
    .type.note { background: #e0eaf2; color: #2b4d6b; }
    .type.concept { background: #f5e8d5; color: #8a4f1c; }
    .type.person { background: #f3dcd2; color: #8a3320; }
    .type.project { background: #dce8df; color: #2f5b4a; }
    .desc { color: #6b6760; }
    .content { white-space: pre-wrap; word-wrap: break-word; background: #f1ede4; padding: 0.75rem 1rem; border-radius: 6px; }
    .claims { padding-left: 1.2rem; }
    .claims .v { font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .claims .v.verified { background: #d4ead4; color: #1f6b1f; }
    .claims .v.disputed { background: #f5e3c8; color: #8a4f1c; }
    .claims .v.unverified { background: #e5e1d8; color: #6b6760; }
    .meta { color: #9c978d; font-size: 12px; }
  </style>
</head>
<body>
  <h1>DO Knowledge Studio — export</h1>
  <p class="meta">Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.</p>
  ${rows}
</body>
</html>`
}

/** Parses and validates an imported JSON export file. */
export const parseImportFile = (text: string): ImportResult => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { success: false, errors: [{ path: 'root', message: 'File is not valid JSON.' }] }
  }
  if (!data || typeof data !== 'object') {
    return { success: false, errors: [{ path: 'root', message: 'JSON root must be an object.' }] }
  }

  const root = data as Record<string, unknown>
  const payload = {
    version: typeof root.version === 'number' ? root.version : 1,
    exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString(),
    entities: root.entities ?? [],
    claims: root.claims ?? [],
    graph: root.graph,
    mindMap: root.mindMap,
    links: root.links,
    tags: root.tags,
  }

  const result = validateImportPayload(payload)
  if (!result.success) {
    return { success: false, errors: result.errors }
  }

  const { entities, claims, graph, mindMap, links, tags } = result.data
  if (entities.length === 0) {
    return { success: false, errors: [{ path: 'entities', message: 'No valid entities found in file.' }] }
  }

  const entityIds = new Set(entities.map((e) => e.id))
  const orphanedClaims = claims.filter((c) => !entityIds.has(c.entityId))
  if (orphanedClaims.length > 0) {
    return {
      success: false,
      errors: orphanedClaims.map((c) => ({
        path: `claims[${c.id}]`,
        message: `Claim references non-existent entity "${c.entityId}".`,
      })),
    }
  }

  return { success: true, entities, claims, graph, mindMap, links, tags }
}
