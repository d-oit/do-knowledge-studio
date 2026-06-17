import { describe, it, expect, vi } from 'vitest';
import { extractEntities } from '../entity-extractor';
import type { LLMProvider, LLMResponse } from '../../llm/types';

describe('extractEntities', () => {
  it('successfully extracts entities and relationships from LLM response', async () => {
    const mockResponse: LLMResponse = {
      content: JSON.stringify({
        entities: [
          { name: 'TRIZ', type: 'tech', description: 'Theory of Inventive Problem Solving' },
          { name: 'Genrich Altshuller', type: 'person', description: 'Inventor of TRIZ' }
        ],
        relationships: [
          { from: 'Genrich Altshuller', to: 'TRIZ', label: 'invented' }
        ]
      }),
      model: 'test-model'
    };

    const mockProvider: Partial<LLMProvider> = {
      chat: vi.fn().mockResolvedValue(mockResponse)
    };

    const result = await extractEntities('Genrich Altshuller invented TRIZ.', mockProvider as LLMProvider, 'test-model');

    expect(result.entities).toHaveLength(2);
    expect(result.entities[0].name).toBe('TRIZ');
    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0].label).toBe('invented');
    expect(mockProvider.chat).toHaveBeenCalledWith(expect.objectContaining({
      model: 'test-model',
      messages: [expect.objectContaining({ role: 'user' })]
    }));
  });

  it('handles LLM response with prose and JSON', async () => {
    const mockResponse: LLMResponse = {
      content: 'Here is the analysis: {"entities": [{"name": "React", "type": "tech", "description": "UI Library"}], "relationships": []} Hope this helps!',
      model: 'test-model'
    };

    const mockProvider: Partial<LLMProvider> = {
      chat: vi.fn().mockResolvedValue(mockResponse)
    };

    const result = await extractEntities('React is a UI library.', mockProvider as LLMProvider, 'test-model');

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe('React');
  });

  it('returns empty result on invalid JSON', async () => {
    const mockResponse: LLMResponse = {
      content: 'Not a JSON response',
      model: 'test-model'
    };

    const mockProvider: Partial<LLMProvider> = {
      chat: vi.fn().mockResolvedValue(mockResponse)
    };

    const result = await extractEntities('Some content', mockProvider as LLMProvider, 'test-model');

    expect(result.entities).toEqual([]);
    expect(result.relationships).toEqual([]);
  });
});
