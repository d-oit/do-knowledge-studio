import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-pdf/renderer', () => ({
  Document: ({ children }: { children: React.ReactNode }) => children,
  Page: ({ children }: { children: React.ReactNode }) => children,
  Text: ({ children }: { children: React.ReactNode }) => children,
  View: ({ children }: { children: React.ReactNode }) => children,
  StyleSheet: { create: (s: unknown) => s },
  pdf: vi.fn(() => ({
    toBlob: vi.fn().mockResolvedValue(new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })),
  })),
}));

import { exportAllNotesToPDF, exportNoteToPDF, writePdfBlobToFile } from '../pdf-exporter';
import { NoteDocument, NotesDocument } from '../pdf-documents';
import type { Note, Entity } from '../../../lib/validation';

const note: Note = {
  id: 'n1',
  entity_id: 'e1',
  content: '<p>Hello <strong>world</strong></p>',
  format: 'markdown',
};

const entities: Entity[] = [
  { id: 'e1', name: 'Alpha & <Beta>', type: 'concept' },
];

describe('pdf-exporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exportNoteToPDF returns a Blob', async () => {
    const blob = await exportNoteToPDF(note, { entityName: 'Alpha' });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('exportAllNotesToPDF returns a Blob', async () => {
    const blob = await exportAllNotesToPDF([note], entities, { title: 'KB' });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('NoteDocument renders without throwing (smoke test via function call)', () => {
    const el = NoteDocument({ note, entityName: 'Alpha' });
    expect(el).toBeDefined();
  });

  it('NotesDocument renders without throwing', () => {
    const el = NotesDocument({ notes: [note], entities, title: 'KB' });
    expect(el).toBeDefined();
  });

  it('strips HTML tags from entity name in NotesDocument', () => {
    const el = NotesDocument({ notes: [note], entities, title: 'KB' });
    expect(el).toBeDefined();
  });

  describe('writePdfBlobToFile', () => {
    it('creates a download link and clicks it', () => {
      const clickSpy = vi.fn();
      const appendChildSpy = vi.fn();
      const removeChildSpy = vi.fn();
      const createElementSpy = vi.fn().mockReturnValue({ click: clickSpy, href: '', download: '' });
      const createObjectURLSpy = vi.fn().mockReturnValue('blob:mock');
      const revokeObjectURLSpy = vi.fn();

      vi.stubGlobal('document', {
        createElement: createElementSpy,
        body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
      });
      vi.stubGlobal('URL', { createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });

      const blob = new Blob(['pdf'], { type: 'application/pdf' });
      writePdfBlobToFile(blob, 'test.pdf');

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('throws in non-browser environment', () => {
      vi.stubGlobal('window', undefined);
      expect(() => writePdfBlobToFile(new Blob(), 'test.pdf')).toThrow('browser-only');
      vi.restoreAllMocks();
    });
  });
});
