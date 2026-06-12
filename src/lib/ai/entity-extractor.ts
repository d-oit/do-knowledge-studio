import type { LLMProvider } from '../llm/types';

export const ENTITY_EXTRACTION_PROMPT = `
Analyze the following note and extract:
1. Named entities (people, organizations, technologies, concepts, places)
2. Relationships between entities

Respond ONLY with valid JSON in this exact schema:
{
  "entities": [
    { "name": string, "type": "person" | "org" | "tech" | "concept" | "place" | "other", "description": string }
  ],
  "relationships": [
    { "from": string, "to": string, "label": string }
  ]
}

Note content:
{{CONTENT}}
`;

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'org' | 'tech' | 'concept' | 'place' | 'other';
  description: string;
}

export interface ExtractedRelationship {
  from: string;
  to: string;
  label: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
}

export async function extractEntities(
  content: string,
  provider: LLMProvider,
  model: string
): Promise<EntityExtractionResult> {
  const prompt = ENTITY_EXTRACTION_PROMPT.replace('{{CONTENT}}', content.slice(0, 2000));
  const response = await provider.chat({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    maxTokens: 1000
  });

  try {
    // Attempt to find JSON in the response if the LLM included prose
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response.content;
    return JSON.parse(jsonStr) as EntityExtractionResult;
  } catch (err) {
    console.error('Failed to parse entity extraction response', err, response.content);
    return { entities: [], relationships: [] };
  }
}
