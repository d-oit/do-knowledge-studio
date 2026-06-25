import type { ToolDefinition } from './types';

export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: 'Search the local knowledge base for relevant notes, entities, and documents',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        limit: { type: 'number', description: 'Max results to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_note',
    description: 'Create a new note in the knowledge studio',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note content in Markdown' },
        tags: { type: 'string', description: 'Comma-separated tags' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'add_graph_node',
    description: 'Add a node to the knowledge graph',
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Node label' },
        type: { type: 'string', description: 'Node type', enum: ['concept', 'person', 'org', 'tech', 'place'] },
        description: { type: 'string', description: 'Node description' },
      },
      required: ['label'],
    },
  },
  {
    name: 'get_current_note',
    description: 'Get the content of the currently active note in the editor',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_entities',
    description: 'List or search entities in the knowledge base with optional type filter',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search term to filter by name or description' },
        type: { type: 'string', description: 'Optional entity type filter (e.g., "person", "concept", "tech")' },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_entity_claims',
    description: 'Get all claims for a specific entity by ID or name',
    parameters: {
      type: 'object',
      properties: {
        entity_id: { type: 'string', description: 'Entity UUID' },
        entity_name: { type: 'string', description: 'Entity name (used if entity_id not provided)' },
      },
      required: [],
    },
  },
  {
    name: 'create_link',
    description: 'Create a relationship link between two entities in the knowledge graph',
    parameters: {
      type: 'object',
      properties: {
        source_name: { type: 'string', description: 'Source entity name' },
        target_name: { type: 'string', description: 'Target entity name' },
        relation: { type: 'string', description: 'Relationship type (e.g., "relates_to", "contradicts", "supports")' },
      },
      required: ['source_name', 'target_name', 'relation'],
    },
  },
];
