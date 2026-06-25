import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '../tool-executor';
import type { ToolCall } from '../types';

// Mock the repository module so tests don't need a real DB
vi.mock('../../../db/repository', () => ({
  repository: {
    createEntity: vi.fn(),
    createNote: vi.fn(),
    createLink: vi.fn(),
    searchEntities: vi.fn(),
    getEntities: vi.fn(),
    getEntityByName: vi.fn(),
    getClaimsByEntityId: vi.fn(),
  },
}));

import { repository } from '../../../db/repository';

const mockSearch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeTool', () => {
  describe('search_knowledge', () => {
    it('returns serialised search results', async () => {
      mockSearch.mockResolvedValue([
        { id: '1', title: 'Alpha', type: 'entity', content: 'Alpha content here', score: 1, stage: '' },
        { id: '2', title: 'Beta', type: 'claim', content: 'Beta content here', score: 0.9, stage: '' },
      ]);

      const call: ToolCall = { id: 'tc1', name: 'search_knowledge', arguments: { query: 'alpha', limit: 2 } };
      const result = await executeTool(call, { search: mockSearch });

      expect(mockSearch).toHaveBeenCalledWith('alpha', { limit: 2 });
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content) as Array<{ title: string; type: string; excerpt: string }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0].title).toBe('Alpha');
    });

    it('defaults limit to 5 when not provided', async () => {
      mockSearch.mockResolvedValue([]);
      const call: ToolCall = { id: 'tc2', name: 'search_knowledge', arguments: { query: 'test' } };
      await executeTool(call, { search: mockSearch });
      expect(mockSearch).toHaveBeenCalledWith('test', { limit: 5 });
    });
  });

  describe('create_note', () => {
    it('creates entity and note, returns success message', async () => {
      vi.mocked(repository.createEntity).mockResolvedValue({ id: 'eid-123', name: 'My Note', type: 'note', rowid: 1 });
      vi.mocked(repository.createNote).mockResolvedValue({ id: 'nid-456', content: 'body', format: 'markdown' });

      const call: ToolCall = {
        id: 'tc3',
        name: 'create_note',
        arguments: { title: 'My Note', content: 'body', tags: 'ai, tools' },
      };
      const result = await executeTool(call, {});

      expect(repository.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Note', type: 'note' })
      );
      expect(repository.createNote).toHaveBeenCalledWith(
        expect.objectContaining({ entity_id: 'eid-123', content: 'body', format: 'markdown' })
      );
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('eid-123');
    });
  });

  describe('add_graph_node', () => {
    it('creates entity and returns success message', async () => {
      vi.mocked(repository.createEntity).mockResolvedValue({ id: 'nid-789', name: 'Quantum', type: 'concept', rowid: 2 });

      const call: ToolCall = {
        id: 'tc4',
        name: 'add_graph_node',
        arguments: { label: 'Quantum', type: 'concept', description: 'Physics topic' },
      };
      const result = await executeTool(call, {});

      expect(repository.createEntity).toHaveBeenCalledWith({ name: 'Quantum', type: 'concept', description: 'Physics topic' });
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('nid-789');
    });

    it('defaults type to concept when not provided', async () => {
      vi.mocked(repository.createEntity).mockResolvedValue({ id: 'x', name: 'Thing', type: 'concept', rowid: 3 });
      const call: ToolCall = { id: 'tc5', name: 'add_graph_node', arguments: { label: 'Thing' } };
      await executeTool(call, {});
      expect(repository.createEntity).toHaveBeenCalledWith(expect.objectContaining({ type: 'concept' }));
    });
  });

  describe('get_current_note', () => {
    it('calls context.getCurrentNoteContent when provided', async () => {
      const call: ToolCall = { id: 'tc6', name: 'get_current_note', arguments: {} };
      const result = await executeTool(call, { getCurrentNoteContent: () => '# My note content' });
      expect(result.content).toBe('# My note content');
      expect(result.isError).toBeFalsy();
    });

    it('returns fallback when no context provided', async () => {
      const call: ToolCall = { id: 'tc7', name: 'get_current_note', arguments: {} };
      const result = await executeTool(call, {});
      expect(result.content).toBe('(no active note)');
    });
  });

  describe('unknown tool', () => {
    it('returns isError=true', async () => {
      const call: ToolCall = { id: 'tc8', name: 'fly_to_moon', arguments: {} };
      const result = await executeTool(call, {});
      expect(result.isError).toBe(true);
      expect(result.content).toContain('fly_to_moon');
    });
  });

  describe('list_entities', () => {
    it('searches entities by query', async () => {
      vi.mocked(repository.searchEntities).mockResolvedValue([
        { id: 'e1', name: 'React', type: 'tech', description: 'UI library' },
      ]);
      const call: ToolCall = { id: 'tc10', name: 'list_entities', arguments: { query: 'React' } };
      const result = await executeTool(call, {});
      expect(repository.searchEntities).toHaveBeenCalledWith('React');
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content) as Array<{ name: string }>;
      expect(parsed[0].name).toBe('React');
    });

    it('lists entities with type filter when no query', async () => {
      vi.mocked(repository.getEntities).mockResolvedValue([
        { id: 'e2', name: 'Altshuller', type: 'person', description: 'Inventor' },
      ]);
      const call: ToolCall = { id: 'tc11', name: 'list_entities', arguments: { type: 'person', limit: 5 } };
      const result = await executeTool(call, {});
      expect(repository.getEntities).toHaveBeenCalledWith({ type: 'person', limit: 5 });
      expect(result.isError).toBeFalsy();
    });

    it('defaults limit to 10', async () => {
      vi.mocked(repository.getEntities).mockResolvedValue([]);
      const call: ToolCall = { id: 'tc12', name: 'list_entities', arguments: {} };
      await executeTool(call, {});
      expect(repository.getEntities).toHaveBeenCalledWith({ type: undefined, limit: 10 });
    });
  });

  describe('get_entity_claims', () => {
    it('fetches claims by entity name', async () => {
      vi.mocked(repository.getEntityByName).mockResolvedValue({ id: 'e1', name: 'React', type: 'tech' });
      vi.mocked(repository.getClaimsByEntityId).mockResolvedValue([
        { id: 'c1', entity_id: 'e1', statement: 'React is popular', confidence: 0.9, verification_status: 'verified', source: 'docs' },
      ]);
      const call: ToolCall = { id: 'tc13', name: 'get_entity_claims', arguments: { entity_name: 'React' } };
      const result = await executeTool(call, {});
      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content) as Array<{ statement: string }>;
      expect(parsed[0].statement).toBe('React is popular');
    });

    it('returns error when entity not found', async () => {
      vi.mocked(repository.getEntityByName).mockResolvedValue(null);
      const call: ToolCall = { id: 'tc14', name: 'get_entity_claims', arguments: { entity_name: 'Nonexistent' } };
      const result = await executeTool(call, {});
      expect(result.isError).toBe(true);
      expect(result.content).toContain('not found');
    });

    it('returns error when neither id nor name provided', async () => {
      const call: ToolCall = { id: 'tc15', name: 'get_entity_claims', arguments: {} };
      const result = await executeTool(call, {});
      expect(result.isError).toBe(true);
      expect(result.content).toContain('entity_id or entity_name');
    });
  });

  describe('create_link', () => {
    it('creates link between two entities', async () => {
      vi.mocked(repository.getEntityByName)
        .mockResolvedValueOnce({ id: 'e1', name: 'Altshuller', type: 'person' })
        .mockResolvedValueOnce({ id: 'e2', name: 'TRIZ', type: 'tech' });
      vi.mocked(repository.createLink).mockResolvedValue({ id: 'l1', source_id: 'e1', target_id: 'e2', relation: 'invented', created_at: '', updated_at: '' });
      const call: ToolCall = { id: 'tc16', name: 'create_link', arguments: { source_name: 'Altshuller', target_name: 'TRIZ', relation: 'invented' } };
      const result = await executeTool(call, {});
      expect(result.isError).toBeFalsy();
      expect(result.content).toContain('Altshuller');
      expect(result.content).toContain('TRIZ');
    });

    it('returns error when source entity not found', async () => {
      vi.mocked(repository.getEntityByName).mockResolvedValue(null);
      const call: ToolCall = { id: 'tc17', name: 'create_link', arguments: { source_name: 'X', target_name: 'Y', relation: 'relates_to' } };
      const result = await executeTool(call, {});
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Source entity');
    });

    it('returns error when target entity not found', async () => {
      vi.mocked(repository.getEntityByName)
        .mockResolvedValueOnce({ id: 'e1', name: 'X', type: 'concept' })
        .mockResolvedValueOnce(null);
      const call: ToolCall = { id: 'tc18', name: 'create_link', arguments: { source_name: 'X', target_name: 'Y', relation: 'relates_to' } };
      const result = await executeTool(call, {});
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Target entity');
    });
  });

  describe('error handling', () => {
    it('catches thrown errors and returns isError=true', async () => {
      mockSearch.mockRejectedValue(new Error('DB offline'));
      const call: ToolCall = { id: 'tc9', name: 'search_knowledge', arguments: { query: 'test' } };
      const result = await executeTool(call, { search: mockSearch });
      expect(result.isError).toBe(true);
      expect(result.content).toContain('DB offline');
    });
  });
});
