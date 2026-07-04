// Wave 3 — work in progress (progressiveSearch semantic toggle).
// Remove it.skip once the progressive search module is stabilised.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@orama/orama', () => ({
  insert: vi.fn().mockResolvedValue('orama-id'),
  insertMultiple: vi.fn().mockResolvedValue(['orama-id-1', 'orama-id-2']),
  remove: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue({ hits: [] }),
  create: vi.fn(() => ({ id: 'mock-db' })),
}));

vi.mock('../../../db/repository.js', () => ({
  repository: {
    getAllEntities: vi.fn().mockResolvedValue([]),
    getAllClaims: vi.fn().mockResolvedValue([]),
    getAllNotes: vi.fn().mockResolvedValue([]),
    getEntityById: vi.fn(),
    getClaimsByEntityId: vi.fn().mockResolvedValue([]),
    getNotesByEntityId: vi.fn().mockResolvedValue([]),
    searchRelated: vi.fn().mockResolvedValue([]),
    getClaimStageMap: vi.fn().mockResolvedValue(new Map()),
    exec: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../errors.js', () => ({
  AppError: class AppError extends Error {
    constructor(message: string, public code: string, public cause?: unknown, public userMessage?: string, public retryable?: boolean) {
      super(message);
    }
  },
}));

vi.mock('../../nlp.js', () => ({
  compressText: (s: string) => s,
}));

vi.mock('../../perf/core.js', () => ({
  perf: { mark: vi.fn(), measure: vi.fn() },
}));

vi.mock('../orama-index.js', () => ({
  oramaDb: null,
  oramaIdMap: new Map(),
  addToOramaMap: vi.fn(),
  embeddingsReady: true,
  embeddingsPlugin: {},
  createOramaIndex: vi.fn(() => ({})),
  clearOramaDb: vi.fn(),
  initEmbeddings: vi.fn(),
}));

vi.mock('../fts5-hydrator.js', () => ({
  hydrateFts5Index: vi.fn().mockResolvedValue(undefined),
}));

import { progressiveSearch, getNoteParentEntityId, clearNoteParentEntityMap } from '../progressive.js';
import * as oramaIndex from '../orama-index.js';
import { repository } from '../../../db/repository.js';

const mockSearch = oramaIndex as unknown as {
  embeddingsReady: boolean;
  embeddingsPlugin: unknown;
};

describe('progressiveSearch (semantic toggle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearNoteParentEntityMap();
    mockSearch.embeddingsReady = true;
    mockSearch.embeddingsPlugin = {};
    (repository.getAllEntities as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (repository.getAllClaims as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (repository.getAllNotes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (repository.getClaimsByEntityId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (repository.getNotesByEntityId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (repository.searchRelated as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it.skip('emits exact and related stages when semantic is disabled', async () => {
    (repository.searchRelated as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', title: 'Related 1', type: 'entity', content: 'c', score: 1, stage: 'verified' },
    ]);
    const stages: string[] = [];
    const onResults = vi.fn((_results: unknown[], stage: string) => {
      stages.push(stage);
    });
    await progressiveSearch('alpha', onResults, { semantic: false });
    expect(stages).toContain('exact');
    expect(stages).toContain('related');
    expect(stages).not.toContain('semantic');
  });

  it.skip('emits the semantic stage when semantic is enabled and embeddings ready', async () => {
    const stages: string[] = [];
    const onResults = vi.fn((_results: unknown[], stage: string) => {
      stages.push(stage);
    });
    await progressiveSearch('alpha', onResults, { semantic: true });
    expect(stages).toContain('semantic');
  });

  it.skip('does not emit the semantic stage when semantic option is omitted', async () => {
    const stages: string[] = [];
    const onResults = vi.fn((_results: unknown[], stage: string) => {
      stages.push(stage);
    });
    await progressiveSearch('alpha', onResults);
    expect(stages).not.toContain('semantic');
  });
});

describe('note parent entity map', () => {
  beforeEach(() => {
    clearNoteParentEntityMap();
  });

  it.skip('returns undefined for unknown note ids', () => {
    expect(getNoteParentEntityId('nope')).toBeUndefined();
  });
});
