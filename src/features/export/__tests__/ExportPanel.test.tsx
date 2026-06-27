import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getAllClaimsGroupedByEntity: vi.fn().mockResolvedValue({}),
    getAllNotesGroupedByEntity: vi.fn().mockResolvedValue({}),
    getAllLinks: vi.fn().mockResolvedValue([]),
    createEntity: vi.fn().mockResolvedValue({ id: 'e1', name: 'Test', type: 'concept' }),
    createNote: vi.fn().mockResolvedValue({ id: 'n1', content: 'test', format: 'markdown' }),
    createClaim: vi.fn().mockResolvedValue({ id: 'c1', statement: 'test' }),
  },
}));

vi.mock('../../../lib/export-core', () => ({
  generateMarkdownExport: vi.fn().mockReturnValue('# Export'),
  generateJsonExport: vi.fn().mockReturnValue('{}'),
  generateSiteHtml: vi.fn().mockReturnValue('<html></html>'),
  fetchAllExportData: vi.fn().mockResolvedValue({
    entities: [],
    claims: {},
    notes: {},
    links: [],
  }),
  importFromJson: vi.fn().mockReturnValue({ entities: [], notes: [], claims: [] }),
}));

vi.mock('../../../lib/markdown-importer', () => ({
  importMarkdownFiles: vi.fn().mockReturnValue({ notes: [] }),
}));

vi.mock('../../../lib/security', () => ({
  stripHtmlTags: vi.fn((s: string) => s),
}));

vi.mock('../pdf-exporter', () => ({
  exportAllNotesToPDF: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  writePdfBlobToFile: vi.fn(),
}));

vi.mock('docx', () => ({
  Document: vi.fn().mockImplementation(() => ({})),
  Packer: { toBlob: vi.fn().mockResolvedValue(new Blob(['docx'])) },
  Paragraph: vi.fn().mockImplementation(() => ({})),
  HeadingLevel: { TITLE: 0, HEADING_1: 1, HEADING_2: 2 },
}));

import ExportPanel from '../ExportPanel';
import { fetchAllExportData, generateMarkdownExport, generateJsonExport, generateSiteHtml, importFromJson } from '../../../lib/export-core';
import { importMarkdownFiles } from '../../../lib/markdown-importer';
import { exportAllNotesToPDF, writePdfBlobToFile } from '../pdf-exporter';

describe('ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(<ExportPanel />);
    expect(screen.getByText('Export Knowledge')).toBeDefined();
  });

  it('renders all export format buttons', () => {
    render(<ExportPanel />);
    expect(screen.getByText('Export as Markdown')).toBeDefined();
    expect(screen.getByText('Export as JSON')).toBeDefined();
    expect(screen.getByText('Export as Static Site')).toBeDefined();
    expect(screen.getByText('Export as PDF')).toBeDefined();
    expect(screen.getByText('Export as DOCX')).toBeDefined();
  });

  it('exports markdown successfully', async () => {
    render(<ExportPanel />);
    fireEvent.click(screen.getByText('Export as Markdown'));
    await waitFor(() => {
      expect(fetchAllExportData).toHaveBeenCalled();
      expect(generateMarkdownExport).toHaveBeenCalled();
    });
  });

  it('exports JSON successfully', async () => {
    render(<ExportPanel />);
    fireEvent.click(screen.getByText('Export as JSON'));
    await waitFor(() => {
      expect(generateJsonExport).toHaveBeenCalled();
    });
  });

  it('exports static site successfully', async () => {
    render(<ExportPanel />);
    fireEvent.click(screen.getByText('Export as Static Site'));
    await waitFor(() => {
      expect(generateSiteHtml).toHaveBeenCalled();
    });
  });

  it('exports PDF successfully', async () => {
    render(<ExportPanel />);
    fireEvent.click(screen.getByText('Export as PDF'));
    await waitFor(() => {
      expect(exportAllNotesToPDF).toHaveBeenCalled();
      expect(writePdfBlobToFile).toHaveBeenCalled();
    });
  });

  it('shows error on export failure', async () => {
    vi.mocked(fetchAllExportData).mockRejectedValueOnce(new Error('DB offline'));
    render(<ExportPanel />);
    fireEvent.click(screen.getByText('Export as Markdown'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('shows import section', () => {
    render(<ExportPanel />);
    expect(screen.getByText('Import Knowledge')).toBeDefined();
    expect(screen.getByText('Import from File')).toBeDefined();
  });

  it('handles JSON import', async () => {
    vi.mocked(importFromJson).mockReturnValueOnce({
      entities: [{ name: 'E1', type: 'concept', description: 'desc' }],
      notes: [{ entity_id: 'e1', content: 'note', format: 'markdown' }],
      claims: [{ entity_id: 'e1', statement: 'claim', confidence: 1.0 }],
    });

    render(<ExportPanel />);
    const input = screen.getByLabelText('Import file');
    const file = new File(['{}'], 'test.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Imported/)).toBeDefined();
    });
  });

  it('handles markdown import', async () => {
    vi.mocked(importMarkdownFiles).mockReturnValueOnce({
      notes: [{ entityId: 'e1', content: '# Note', format: 'markdown' }],
    });

    render(<ExportPanel />);
    const input = screen.getByLabelText('Import file');
    const file = new File(['# Note'], 'note.md', { type: 'text/markdown' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Imported/)).toBeDefined();
    });
  });

  it('shows error for unsupported file format', async () => {
    render(<ExportPanel />);
    const input = screen.getByLabelText('Import file');
    const file = new File(['data'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});
