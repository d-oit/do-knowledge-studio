import type { ToolCall, ToolResult } from './types';
import { searchKnowledge } from '../search';
import { repository } from '../../db/repository';

/** Context provided to each tool execution. Allows overriding deps in tests. */
export interface ToolExecutionContext {
  search?: typeof searchKnowledge;
  getCurrentNoteContent?: () => string;
}

export async function executeTool(
  toolCall: ToolCall,
  context: ToolExecutionContext = {},
): Promise<ToolResult> {
  const search = context.search ?? searchKnowledge;

  try {
    switch (toolCall.name) {
      case 'search_knowledge': {
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

      case 'create_note': {
        const title = toolCall.arguments.title as string;
        const content = toolCall.arguments.content as string;
        const tags = ((toolCall.arguments.tags as string | undefined) ?? '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        // Create entity (the titled concept) then attach the note
        const entity = await repository.createEntity({
          name: title,
          type: 'note',
          description: tags.length > 0 ? `Tags: ${tags.join(', ')}` : undefined,
        });
        await repository.createNote({ entity_id: entity.id, content, format: 'markdown' });
        return { toolCallId: toolCall.id, content: `Note "${title}" created (entity id: ${entity.id})` };
      }

      case 'add_graph_node': {
        const label = toolCall.arguments.label as string;
        const type = (toolCall.arguments.type as string | undefined) ?? 'concept';
        const description = toolCall.arguments.description as string | undefined;
        const entity = await repository.createEntity({ name: label, type, description });
        return { toolCallId: toolCall.id, content: `Graph node "${label}" added (id: ${entity.id})` };
      }

      case 'get_current_note': {
        const content = context.getCurrentNoteContent?.() ?? '(no active note)';
        return { toolCallId: toolCall.id, content };
      }

      default:
        return { toolCallId: toolCall.id, content: `Unknown tool: ${toolCall.name}`, isError: true };
    }
  } catch (err) {
    return { toolCallId: toolCall.id, content: String(err), isError: true };
  }
}
