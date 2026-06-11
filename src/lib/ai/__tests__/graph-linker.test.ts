import { describe, it, expect, vi } from 'vitest';
import { applyEntitiesToGraph } from '../graph-linker';
import { IRepository } from '../../../db/repository/types';
import { EntityExtractionResult } from '../entity-extractor';
import { Entity } from '../../../lib/validation';

describe('applyEntitiesToGraph', () => {
  it('creates new entities and links if they do not exist', async () => {
    const mockRepository: Partial<IRepository> = {
      getEntityByName: vi.fn().mockResolvedValue(null),
      createEntity: vi.fn().mockImplementation((e: Omit<Entity, 'id' | 'created_at' | 'updated_at'>) => Promise.resolve({ ...e, id: 'new-id-' + e.name, rowid: 1 })),
      createLink: vi.fn().mockResolvedValue({ id: 'link-id' }),
      getAllLinks: vi.fn().mockResolvedValue([])
    };

    const result: EntityExtractionResult = {
      entities: [
        { name: 'Apple', type: 'org', description: 'Tech company' },
        { name: 'Steve Jobs', type: 'person', description: 'Co-founder' }
      ],
      relationships: [
        { from: 'Steve Jobs', to: 'Apple', label: 'founded' }
      ]
    };

    await applyEntitiesToGraph(result, mockRepository as IRepository, ['Apple', 'Steve Jobs'], ['Steve Jobs->Apple'], 'note-123');

    expect(mockRepository.createEntity).toHaveBeenCalledTimes(2);
    expect(mockRepository.createEntity).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Apple'
    }));
    expect(mockRepository.createLink).toHaveBeenCalledTimes(1);
    expect(mockRepository.createLink).toHaveBeenCalledWith(expect.objectContaining({
      relation: 'founded'
    }));
  });

  it('reuses existing entities', async () => {
    const mockRepository: Partial<IRepository> = {
      getEntityByName: vi.fn().mockImplementation((name: string) => {
        if (name === 'Existing') return Promise.resolve({ id: 'existing-id', name: 'Existing', type: 'org' } as Entity);
        return Promise.resolve(null);
      }),
      createEntity: vi.fn().mockImplementation((e: Omit<Entity, 'id' | 'created_at' | 'updated_at'>) => Promise.resolve({ ...e, id: 'new-id', rowid: 1 })),
      createLink: vi.fn().mockResolvedValue({ id: 'link-id' }),
      getAllLinks: vi.fn().mockResolvedValue([])
    };

    const result: EntityExtractionResult = {
      entities: [
        { name: 'Existing', type: 'org', description: 'Already there' },
        { name: 'New', type: 'org', description: 'Not there' }
      ],
      relationships: []
    };

    await applyEntitiesToGraph(result, mockRepository as IRepository, ['Existing', 'New'], []);

    expect(mockRepository.createEntity).toHaveBeenCalledTimes(1);
    expect(mockRepository.createEntity).toHaveBeenCalledWith(expect.objectContaining({ name: 'New' }));
  });

  it('only applies selected entities and relationships', async () => {
    const mockRepository: Partial<IRepository> = {
      getEntityByName: vi.fn().mockResolvedValue(null),
      createEntity: vi.fn().mockImplementation((e: Omit<Entity, 'id' | 'created_at' | 'updated_at'>) => Promise.resolve({ ...e, id: 'id', rowid: 1 })),
      createLink: vi.fn().mockResolvedValue({ id: 'link-id' }),
      getAllLinks: vi.fn().mockResolvedValue([])
    };

    const result: EntityExtractionResult = {
      entities: [
        { name: 'A', type: 'concept', description: '' },
        { name: 'B', type: 'concept', description: '' }
      ],
      relationships: [
        { from: 'A', to: 'B', label: 'rel' }
      ]
    };

    await applyEntitiesToGraph(result, mockRepository as IRepository, ['A'], []);

    expect(mockRepository.createEntity).toHaveBeenCalledTimes(1);
    expect(mockRepository.createEntity).toHaveBeenCalledWith(expect.objectContaining({ name: 'A' }));
    expect(mockRepository.createLink).not.toHaveBeenCalled();
  });
});
