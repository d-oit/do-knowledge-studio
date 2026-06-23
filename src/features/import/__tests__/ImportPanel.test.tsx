import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getEntityByName: vi.fn().mockResolvedValue(null),
  createEntity: vi.fn().mockImplementation((input: { name: string; type: string }) => Promise.resolve({
    id: `id-${input.name}`,
    name: input.name,
    type: input.type,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })),
  createNote: vi.fn().mockResolvedValue({ id: 'n1' }),
  createClaim: vi.fn().mockResolvedValue({ id: 'c1' }),
  hydrate: vi.fn().mockResolvedValue(undefined),
  enqueue: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../lib/logger', () => ({ logger: mocks.logger }));

vi.mock('../../../db/repository', () => ({
  repository: {
    getEntityByName: mocks.getEntityByName,
    createEntity: mocks.createEntity,
    createNote: mocks.createNote,
    createClaim: mocks.createClaim,
  },
}));

vi.mock('../../../lib/search/fts5-hydrator', () => ({
  hydrateFts5Index: mocks.hydrate,
}));

vi.mock('../../../lib/jobs', () => ({
  jobCoordinator: { enqueue: mocks.enqueue },
}));

import ImportPanel from '../ImportPanel';

function makeJsonExport(): string {
  return JSON.stringify({
    version: '1.0',
    exportedAt: '2026-06-22T00:00:00.000Z',
    metadata: { title: 'Test', source: 'browser' },
    entities: [
      { name: 'Alpha', type: 'concept', description: 'alpha entity' },
      { name: 'Beta', type: 'person' },
    ],
    notes: [],
    claims: [],
    links: [],
    graph: { nodes: [], edges: [] },
    mindMap: null,
    tags: [],
  });
}

describe('ImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEntityByName.mockResolvedValue(null);
  });

  it('renders without crashing', () => {
    render(<ImportPanel />);
    expect(screen.getByText('Import Knowledge')).toBeDefined();
  });

  it('shows the drop zone and browse prompt', () => {
    render(<ImportPanel />);
    expect(screen.getByText(/Drop a file here/)).toBeDefined();
  });

  it('previews a JSON file when selected', async () => {
    render(<ImportPanel />);
    const file = new File([makeJsonExport()], 'kb.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText('kb.json')).toBeDefined();
    });
    const buttons = screen.getAllByRole('button');
    const importButton = buttons.find((b) => b.textContent?.includes('Import 2'));
    expect(importButton).toBeDefined();
  });

  it('shows an error for unsupported file type', async () => {
    render(<ImportPanel />);
    const file = new File(['hello'], 'readme.txt', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/)).toBeDefined();
    });
  });

  it('handles drag-and-drop', async () => {
    render(<ImportPanel />);
    const file = new File([makeJsonExport()], 'drop.json', { type: 'application/json' });
    const dropZone = screen.getByRole('button', { name: /Drop file here/ });
    const data = { dataTransfer: { files: [file] } };
    fireEvent.drop(dropZone, data);

    await waitFor(() => {
      expect(screen.getByText('drop.json')).toBeDefined();
    });
  });
});
