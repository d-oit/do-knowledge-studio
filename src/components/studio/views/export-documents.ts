import type { Entity, Claim } from '@/lib/studio/types'
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
import { buildClaimsByEntityId } from './export-types'

/** Builds a print-ready PDF blob for all entities and claims. */
export const buildPdfExport = (entities: Entity[], claims: Claim[]): Blob => {
  const claimsByEntity = buildClaimsByEntityId(claims)
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

    const entityClaims = claimsByEntity.get(e.id) ?? []
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

/** Builds a Word (.docx) blob for all entities and claims. */
export const buildDocxExport = (entities: Entity[], claims: Claim[]): Promise<Blob> => {
  const claimsByEntity = buildClaimsByEntityId(claims)
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

    const entityClaims = claimsByEntity.get(e.id) ?? []
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
