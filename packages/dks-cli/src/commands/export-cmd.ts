/**
 * `dks export` — read-only bundle rendering. Human/text output prints the
 * bundle as markdown (dks-core's export renderer); `--format json` prints
 * the rebuilt OKF bundle JSON envelope. stdout only; never any write.
 */

import { buildMarkdownExport, buildOkfBundle, type CoreExportEdge, type CoreExportClaim, type LoadedBundle } from 'dks-core'
import { bundleClaims } from '../bundle.js'
import type { OutputFormat } from '../args.js'

export interface OkfBundleExport {
  okfVersion: '0.2'
  files: { path: string; content: string }[]
}

export type ExportData = { rendered: string } | OkfBundleExport

/** Separator header placed before each markdown file in text output. */
const FILE_HEADER_PREFIX = '<!-- dks-export file: '
const FILE_HEADER_SUFFIX = ' -->'

/** Converts a blob of concept markdown files into one text document. */
export const exportMarkdown = (bundle: LoadedBundle): { rendered: string } => {
  const entities = bundle.concepts
  const files = buildMarkdownExport(entities)
  const rendered = files
    .map((file) => `${FILE_HEADER_PREFIX}${file.path}${FILE_HEADER_SUFFIX}\n\n${file.content}`)
    .join('\n\n')
  return { rendered }
}

/** Rebuilds the OKF v0.2 bundle JSON from the loaded corpus. */
export const exportOkfBundle = (bundle: LoadedBundle): OkfBundleExport => {
  const claims: CoreExportClaim[] = bundleClaims(bundle).map((claim) => {
    const exportClaim: CoreExportClaim = { entityId: claim.entityId, statement: claim.statement }
    if (claim.source !== undefined) exportClaim.source = claim.source
    if (claim.evidence !== undefined) exportClaim.evidence = claim.evidence
    return exportClaim
  })
  const edges: CoreExportEdge[] = bundle.concepts.flatMap((concept) =>
    concept.relatedIds.map((targetId) => ({ source: concept.id, target: targetId })),
  )
  const bundleExport = buildOkfBundle(bundle.concepts, claims, edges)
  return { okfVersion: bundleExport.okfVersion, files: bundleExport.files }
}

/** Dispatches by output format; text mode renders markdown. */
export const exportData = (bundle: LoadedBundle, format: OutputFormat): ExportData =>
  format === 'json' ? exportOkfBundle(bundle) : exportMarkdown(bundle)
