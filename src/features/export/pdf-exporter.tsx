/**
 * PDF exporter using @react-pdf/renderer.
 *
 * Mirrors the dynamic-import pattern used for `docx` so the ~1.5MB bundle
 * is only loaded when the user actually exports to PDF. See ADR-012.
 *
 * React components live in `./pdf-documents.tsx` to satisfy
 * react-refresh/only-export-components.
 */
import { pdf } from '@react-pdf/renderer';
import type { Entity, Note } from '../../lib/validation';
import { NoteDocument, NotesDocument } from './pdf-documents';

export async function exportNoteToPDF(
  note: Note,
  opts?: { entityName?: string },
): Promise<Blob> {
  return pdf(<NoteDocument note={note} entityName={opts?.entityName} />).toBlob();
}

export async function exportAllNotesToPDF(
  notes: Note[],
  entities: Entity[],
  opts?: { title?: string },
): Promise<Blob> {
  return pdf(<NotesDocument notes={notes} entities={entities} title={opts?.title} />).toBlob();
}

export function writePdfBlobToFile(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') {
    throw new Error('writePdfBlobToFile is browser-only');
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
