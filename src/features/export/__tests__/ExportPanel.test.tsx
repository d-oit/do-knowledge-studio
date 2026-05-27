import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getAllClaimsGroupedByEntity: vi.fn().mockResolvedValue({}),
    getAllNotesGroupedByEntity: vi.fn().mockResolvedValue({}),
    getAllLinks: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../lib/export-core', () => ({
  generateMarkdownExport: vi.fn().mockReturnValue('# Export'),
  generateJsonExport: vi.fn().mockReturnValue('{}'),
  generateSiteHtml: vi.fn().mockReturnValue('<html></html>'),
  generatePrintHtml: vi.fn().mockReturnValue('<html></html>'),
}));

import ExportPanel from '../ExportPanel';

describe('ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('shows description text', () => {
    render(<ExportPanel />);
    expect(screen.getByText(/Generate portable versions/)).toBeDefined();
  });
});
