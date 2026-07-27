import type { Entity, Claim } from '@/lib/studio/types'
import {
  FileText,
  FileJson,
  FileCode,
  FileArchive,
  FileLock,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ExternalHyperlink,
} from 'docx'
import { validateImportPayload, type ValidationError } from '@/lib/studio/schema'

export type ExportFormatId = 'json' | 'markdown' | 'html' | 'pdf' | 'docx' | 'encrypted'

export type ImportResult =
  | { success: true; entities: Entity[]; claims: Claim[] }
  | { success: false; errors: ValidationError[] }

export interface ImportPreview {
  entities: Entity[]
  claims: Claim[]
  entityCount: number
  claimCount: number
  version: number
  duplicateIds: string[]
}

export type ExportColorKey = 'saffron' | 'sky' | 'sage' | 'clay'

export interface ExportFormat {
  id: ExportFormatId
  name: string
  description: string
  icon: typeof FileText
  color: ExportColorKey
  badge?: string
  available?: boolean
}

export const FORMATS: ExportFormat[] = [
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Single .md file with every entity (and its claims) separated by ---.',
    icon: FileText,
    color: 'saffron',
    available: true,
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'Single .json file with all entities, claims, and links. Best for backup.',
    icon: FileJson,
    color: 'sky',
    available: true,
  },
  {
    id: 'html',
    name: 'Static HTML',
    description: 'Single self-contained .html page that renders all entities. Open in any browser.',
    icon: FileCode,
    color: 'sage',
    available: true,
  },
  {
    id: 'pdf',
    name: 'PDF document',
    description: 'Formatted PDF with all entities, claims, and metadata. Print-ready.',
    icon: FileArchive,
    color: 'clay',
    available: true,
  },
  {
    id: 'docx',
    name: 'DOCX document',
    description: 'Word document with structured entities, claims, and hyperlinks.',
    icon: FileText,
    color: 'saffron',
    available: true,
  },
  {
    id: 'encrypted',
    name: 'Encrypted HTML',
    description: 'Self-contained reader protected by a password. Safe to share privately.',
    icon: FileLock,
    color: 'clay',
    badge: 'Secure',
    available: true,
  },
]

export const COLOR_MAP: Record<ExportColorKey, string> = {
  saffron: 'bg-saffron-soft text-saffron-deep',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  sage: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  clay: 'bg-rose-100 text-clay dark:bg-rose-950/40 dark:text-rose-300',
}

export function todayStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function downloadFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(filename, blob)
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildJsonExport(entities: Entity[], claims: Claim[]): string {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entities,
    claims,
  }
  return JSON.stringify(payload, null, 2)
}

export function buildMarkdownExport(entities: Entity[], claims: Claim[]): string {
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

    const entityClaims = claims.filter((c) => c.entityId === e.id)
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

export function buildHtmlExport(entities: Entity[], claims: Claim[]): string {
  const rows = entities
    .map((e) => {
      const entityClaims = claims.filter((c) => c.entityId === e.id)
      const claimsHtml = entityClaims.length
        ? `<ul class="claims">${entityClaims
            .map(
              (c) =>
                `<li><span class="v ${c.verification}">${c.verification}</span> ${escapeHtml(
                  c.statement,
                )} <span class="meta">(${Math.round(c.confidence * 100)}%)</span></li>`,
            )
            .join('')}</ul>`
        : '<p class="meta">No claims.</p>'
      return `<article>
  <header>
    <span class="type ${e.type}">${e.type}</span>
    <h2>${escapeHtml(e.name)}</h2>
    <p class="meta">${e.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</p>
  </header>
  <p class="desc">${escapeHtml(e.description)}</p>
  <pre>${escapeHtml(e.content)}</pre>
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
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f1ede4; padding: 0.75rem 1rem; border-radius: 6px; }
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

export function buildPdfExport(entities: Entity[], claims: Claim[]): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = 210 - margin * 2
  let y = margin

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > 297 - margin) {
      doc.addPage()
      y = margin
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('DO Knowledge Studio', margin, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(
    `Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.`,
    margin,
    y,
  )
  y += 10

  for (const e of entities) {
    addPageIfNeeded(30)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(30)
    doc.text(e.name, margin, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120)
    const meta = `Type: ${e.type} | Tags: ${e.tags.join(', ') || 'none'} | Created: ${e.createdAt?.slice(0, 10) ?? '—'}`
    doc.text(meta, margin, y)
    y += 5

    if (e.description) {
      doc.setFontSize(10)
      doc.setTextColor(60)
      const descLines = doc.splitTextToSize(e.description, pageWidth)
      doc.text(descLines, margin, y)
      y += descLines.length * 4.5 + 2
    }

    if (e.content) {
      doc.setFontSize(10)
      doc.setTextColor(30)
      const contentLines = doc.splitTextToSize(e.content, pageWidth)
      for (const line of contentLines) {
        addPageIfNeeded(5)
        doc.text(line, margin, y)
        y += 4.5
      }
      y += 2
    }

    const entityClaims = claims.filter((c) => c.entityId === e.id)
    if (entityClaims.length) {
      addPageIfNeeded(8)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(30)
      doc.text('Claims', margin, y)
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      for (const c of entityClaims) {
        addPageIfNeeded(8)
        const pct = Math.round(c.confidence * 100)
        const line = `[${c.verification}] ${c.statement} (${pct}%)`
        const lines = doc.splitTextToSize(line, pageWidth)
        doc.text(lines, margin, y)
        y += lines.length * 4 + 2
      }
    }

    y += 4
    doc.setDrawColor(200)
    doc.line(margin, y, margin + pageWidth, y)
    y += 6
  }

  return doc.output('blob')
}

export async function buildDocxExport(entities: Entity[], claims: Claim[]): Promise<Blob> {
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'DO Knowledge Studio', bold: true, size: 36 })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.`,
          size: 20,
          color: '6B6760',
        }),
      ],
      spacing: { after: 300 },
    }),
  )

  for (const e of entities) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: e.name, bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      }),
    )

    const metaText = `Type: ${e.type} | Tags: ${e.tags.join(', ') || 'none'} | Created: ${e.createdAt?.slice(0, 10) ?? '—'}`
    children.push(
      new Paragraph({
        children: [new TextRun({ text: metaText, size: 18, color: '6B6760' })],
        spacing: { after: 100 },
      }),
    )

    if (e.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: e.description, size: 22 })],
          spacing: { after: 100 },
        }),
      )
    }

    if (e.content) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: e.content, size: 22 })],
          spacing: { after: 100 },
        }),
      )
    }

    if (e.sourceUrl) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Source: ', size: 18, color: '6B6760' }),
            new ExternalHyperlink({ children: [new TextRun({ text: e.sourceUrl, style: 'Hyperlink', size: 18 })], link: e.sourceUrl }),
          ],
          spacing: { after: 100 },
        }),
      )
    }

    const entityClaims = claims.filter((c) => c.entityId === e.id)
    if (entityClaims.length) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Claims', bold: true, size: 24 })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 100 },
        }),
      )

      for (const c of entityClaims) {
        const pct = Math.round(c.confidence * 100)
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${c.verification}] `, bold: true, size: 20 }),
              new TextRun({ text: `${c.statement} `, size: 20 }),
              new TextRun({ text: `(${pct}%)`, size: 18, color: '6B6760' }),
            ],
            spacing: { after: 50 },
          }),
        )
      }
    }

    children.push(new Paragraph({ spacing: { after: 200 } }))
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  return Packer.toBlob(doc)
}

export function parseImportFile(text: string): ImportResult {
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
  }

  const result = validateImportPayload(payload)
  if (!result.success) {
    return { success: false, errors: result.errors }
  }

  const { entities, claims } = result.data
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

  return { success: true, entities, claims }
}
