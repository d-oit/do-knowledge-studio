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
];
