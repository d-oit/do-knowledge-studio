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

/** A4 PDF layout constants shared by the PDF builder helpers. */
const PDF_MARGIN = 20
const PDF_PAGE_WIDTH = 210 - PDF_MARGIN * 2
const PDF_PAGE_HEIGHT = 297

/** Returns the metadata line for an entity (type, tags, created date). */
const pdfEntityMeta = (e: Entity): string =>
  `Type: ${e.type} | Tags: ${e.tags.join(', ') || 'none'} | Created: ${e.createdAt?.slice(0, 10) ?? '—'}`

/** Draws a wrapped text block, adding pages as needed; returns the new cursor y. */
const drawWrappedText = (
  doc: jsPDF,
  text: string,
  y: number,
  fontSize: number,
  lineHeight: number,
  needed: number,
): number => {
  doc.setFontSize(fontSize)
  const lines = doc.splitTextToSize(text, PDF_PAGE_WIDTH)
  for (const line of lines) {
    if (y + needed > PDF_PAGE_HEIGHT - PDF_MARGIN) {
      doc.addPage()
      y = PDF_MARGIN
    }
    doc.text(line, PDF_MARGIN, y)
    y += lineHeight
  }
  return y
}

/** Draws the claims section for an entity and returns the updated cursor y. */
const renderPdfClaims = (doc: jsPDF, claims: Claim[], y: number): number => {
  let cursor = y
  if (cursor + 8 > PDF_PAGE_HEIGHT - PDF_MARGIN) {
    doc.addPage()
    cursor = PDF_MARGIN
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30)
  doc.text('Claims', PDF_MARGIN, cursor)
  cursor += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const c of claims) {
    const pct = Math.round(c.confidence * 100)
    cursor = drawWrappedText(doc, `[${c.verification}] ${c.statement} (${pct}%)`, cursor, 9, 4, 8)
    cursor += 2
  }
  return cursor
}

/** Draws the entity name header and metadata line; returns the updated cursor y. */
const renderPdfHeader = (doc: jsPDF, e: Entity, y: number): number => {
  let cursor = y
  if (cursor + 30 > PDF_PAGE_HEIGHT - PDF_MARGIN) {
    doc.addPage()
    cursor = PDF_MARGIN
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30)
  doc.text(e.name, PDF_MARGIN, cursor)
  cursor += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(pdfEntityMeta(e), PDF_MARGIN, cursor)
  return cursor + 5
}

/** Draws one entity (header, description, content, claims) and returns the updated cursor y. */
const renderPdfEntity = (
  doc: jsPDF,
  e: Entity,
  claimsByEntity: Map<string, Claim[]>,
  y: number,
): number => {
  let cursor = renderPdfHeader(doc, e, y)

  if (e.description) {
    doc.setFontSize(10)
    doc.setTextColor(60)
    cursor = drawWrappedText(doc, e.description, cursor, 10, 4.5, 5)
    cursor += 2
  }

  if (e.content) {
    doc.setFontSize(10)
    doc.setTextColor(30)
    cursor = drawWrappedText(doc, e.content, cursor, 10, 4.5, 5)
    cursor += 2
  }

  const entityClaims = claimsByEntity.get(e.id) ?? []
  if (entityClaims.length) {
    cursor = renderPdfClaims(doc, entityClaims, cursor)
  }

  return cursor
}

/** Builds a print-ready PDF blob for all entities and claims. */
export const buildPdfExport = (entities: Entity[], claims: Claim[]): Blob => {
  const claimsByEntity = buildClaimsByEntityId(claims)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = PDF_MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('DO Knowledge Studio', PDF_MARGIN, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(
    `Exported ${new Date().toLocaleString()}. ${entities.length} entities, ${claims.length} claims.`,
    PDF_MARGIN,
    y,
  )
  y += 10

  for (const e of entities) {
    y = renderPdfEntity(doc, e, claimsByEntity, y)
    y += 4
    doc.setDrawColor(200)
    doc.line(PDF_MARGIN, y, PDF_MARGIN + PDF_PAGE_WIDTH, y)
    y += 6
  }

  return doc.output('blob')
}

/** Returns the metadata text for an entity (type, tags, created date). */
const docxMetaText = (e: Entity): string =>
  `Type: ${e.type} | Tags: ${e.tags.join(', ') || 'none'} | Created: ${e.createdAt?.slice(0, 10) ?? '—'}`

/** Builds the intro paragraphs (title + export metadata) for the DOCX document. */
const buildDocxIntro = (entities: Entity[], claims: Claim[]): Paragraph[] => [
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
]

/** Builds the claim paragraphs for an entity. */
const buildDocxClaimParagraphs = (claims: Claim[]): Paragraph[] => {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'Claims', bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 150, after: 100 },
    }),
  ]

  for (const c of claims) {
    const pct = Math.round(c.confidence * 100)
    paragraphs.push(
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
  return paragraphs
}

/** Builds the paragraphs describing a single entity (header, body, source). */
const buildDocxEntityParagraphs = (e: Entity): Paragraph[] => {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: e.name, bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: docxMetaText(e), size: 18, color: '6B6760' })],
      spacing: { after: 100 },
    }),
  ]

  if (e.description) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: e.description, size: 22 })],
        spacing: { after: 100 },
      }),
    )
  }

  if (e.content) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: e.content, size: 22 })],
        spacing: { after: 100 },
      }),
    )
  }

  if (e.sourceUrl) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Source: ', size: 18, color: '6B6760' }),
          new ExternalHyperlink({ children: [new TextRun({ text: e.sourceUrl, style: 'Hyperlink', size: 18 })], link: e.sourceUrl }),
        ],
        spacing: { after: 100 },
      }),
    )
  }

  return paragraphs
}

/** Builds a Word (.docx) blob for all entities and claims. */
export const buildDocxExport = (entities: Entity[], claims: Claim[]): Promise<Blob> => {
  const claimsByEntity = buildClaimsByEntityId(claims)
  const children: Paragraph[] = [...buildDocxIntro(entities, claims)]

  for (const e of entities) {
    children.push(...buildDocxEntityParagraphs(e))
    const entityClaims = claimsByEntity.get(e.id) ?? []
    if (entityClaims.length) {
      children.push(...buildDocxClaimParagraphs(entityClaims))
    }
    children.push(new Paragraph({ spacing: { after: 200 } }))
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  return Packer.toBlob(doc)
}
