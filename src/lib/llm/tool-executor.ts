import type { ToolCall, ToolResult } from './types';
import { searchKnowledge } from '../search';
import { repository } from '../../db/repository';
import { logger } from '../logger';

export interface ToolExecutionContext {
  search?: typeof searchKnowledge;
  getCurrentNoteContent?: () => string;
}

async function handleSearchKnowledge(toolCall: ToolCall, search: typeof searchKnowledge): Promise<ToolResult> {
  const query = toolCall.arguments.query as string;
  const limit = (toolCall.arguments.limit as number | undefined) ?? 5;
  const results = await search(query, { limit });
  const summary = results.map(r => ({
    title: r.title,
    type: r.type,
    excerpt: r.content.slice(0, 200),
  }));
  return { toolCallId: toolCall.id, content: JSON.stringify(summary) };
}

async function handleCreateNote(toolCall: ToolCall): Promise<ToolResult> {
  const title = toolCall.arguments.title as string;
  const content = toolCall.arguments.content as string;
  const tags = ((toolCall.arguments.tags as string | undefined) ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  const entity = await repository.createEntity({
    name: title,
    type: 'note',
    description: tags.length > 0 ? `Tags: ${tags.join(', ')}` : undefined,
  });
  await repository.createNote({ entity_id: entity.id, content, format: 'markdown' });
  return { toolCallId: toolCall.id, content: `Note "${title}" created (entity id: ${entity.id})` };
}

async function handleAddGraphNode(toolCall: ToolCall): Promise<ToolResult> {
  const label = toolCall.arguments.label as string;
  const type = (toolCall.arguments.type as string | undefined) ?? 'concept';
  const description = toolCall.arguments.description as string | undefined;
  const entity = await repository.createEntity({ name: label, type, description });
  return { toolCallId: toolCall.id, content: `Graph node "${label}" added (id: ${entity.id})` };
}

function handleGetCurrentNote(toolCall: ToolCall, context: ToolExecutionContext): ToolResult {
  const content = context.getCurrentNoteContent?.() ?? '(no active note)';
  return { toolCallId: toolCall.id, content };
}

export async function executeTool(
  toolCall: ToolCall,
  context: ToolExecutionContext = {},
): Promise<ToolResult> {
  const search = context.search ?? searchKnowledge;

  try {
    switch (toolCall.name) {
      case 'search_knowledge':
        return await handleSearchKnowledge(toolCall, search);
      case 'create_note':
        return await handleCreateNote(toolCall);
      case 'add_graph_node':
        return await handleAddGraphNode(toolCall);
      case 'get_current_note':
        return handleGetCurrentNote(toolCall, context);
      default:
        return { toolCallId: toolCall.id, content: `Unknown tool: ${toolCall.name}`, isError: true };
    }
  } catch (err) {
    logger.error('Tool execution failed', { tool: toolCall.name, error: err });
    return { toolCallId: toolCall.id, content: String(err), isError: true };
  }
}
