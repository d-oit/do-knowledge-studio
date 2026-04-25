import { Entity } from './validation.js';
import { logger } from './logger.js';

const API_KEY = import.meta.env.VITE_LLM_API_KEY;
const BASE_URL = import.meta.env.VITE_LLM_API_BASE_URL || 'https://api.openai.com/v1';

export interface ExtractedKnowledge {
  entities: Omit<Entity, 'id' | 'created_at' | 'updated_at'>[];
  links: {
    source_name: string;
    target_name: string;
    relation: string;
  }[];
}

export const aiService = {
  /**
   * Generates a vector embedding for the given text.
   * Returns a zero-vector if the API key is missing or the request fails.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!API_KEY) {
      logger.warn('AI Service: VITE_LLM_API_KEY not found. Returning dummy embedding.');
      return new Array(1536).fill(0);
    }

    try {
      const response = await fetch(`${BASE_URL}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small',
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (err) {
      logger.error('Failed to generate embedding', err);
      return new Array(1536).fill(0);
    }
  },

  /**
   * Extracts entities and relationships from the provided text using an LLM.
   */
  async extractKnowledge(text: string): Promise<ExtractedKnowledge> {
    if (!API_KEY) {
      throw new Error('AI Service: VITE_LLM_API_KEY not found.');
    }

    const prompt = `
Extract entities and their relationships from the following text.
Format the output as a JSON object with two arrays: "entities" and "links".

Each entity MUST have:
- "name": String
- "type": One of "person", "concept", "project", "note"
- "description": A brief summary

Each link MUST have:
- "source_name": Name of the source entity
- "target_name": Name of the target entity
- "relation": A short description of the relationship (e.g., "is a", "works on", "leads")

Text:
${text}

JSON:
`;

    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Extraction request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);

      return {
        entities: content.entities || [],
        links: content.links || [],
      };
    } catch (err) {
      logger.error('Failed to extract knowledge', err);
      throw err;
    }
  },
};
