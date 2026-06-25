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

async function handleListEntities(toolCall: ToolCall): Promise<ToolResult> {
  const query = toolCall.arguments.query as string | undefined;
  const type = toolCall.arguments.type as string | undefined;
  const limit = (toolCall.arguments.limit as number | undefined) ?? 10;

  let entities: Awaited<ReturnType<typeof repository.searchEntities>>;
  if (query) {
    entities = await repository.searchEntities(query);
  } else {
    entities = await repository.getEntities({ type, limit });
  }

  const summary = entities.slice(0, limit).map(e => ({
    id: e.id,
    name: e.name,
    type: e.type,
    description: e.description?.slice(0, 100) || '',
  }));

  return { toolCallId: toolCall.id, content: JSON.stringify(summary) };
}

async function handleGetEntityClaims(toolCall: ToolCall): Promise<ToolResult> {
  let entityId = toolCall.arguments.entity_id as string | undefined;
  const entityName = toolCall.arguments.entity_name as string | undefined;

  if (!entityId && entityName) {
    const entity = await repository.getEntityByName(entityName);
    if (!entity) {
      return { toolCallId: toolCall.id, content: `Entity "${entityName}" not found`, isError: true };
    }
    entityId = entity.id;
  }

  if (!entityId) {
    return { toolCallId: toolCall.id, content: 'Either entity_id or entity_name is required', isError: true };
  }

  const claims = await repository.getClaimsByEntityId(entityId);
  const summary = claims.map(c => ({
    statement: c.statement,
    confidence: c.confidence,
    verification_status: c.verification_status,
    source: c.source || 'none',
  }));

  return { toolCallId: toolCall.id, content: JSON.stringify(summary) };
}

async function handleCreateLink(toolCall: ToolCall): Promise<ToolResult> {
  const sourceName = toolCall.arguments.source_name as string;
  const targetName = toolCall.arguments.target_name as string;
  const relation = toolCall.arguments.relation as string;

  const source = await repository.getEntityByName(sourceName);
  if (!source) return { toolCallId: toolCall.id, content: `Source entity "${sourceName}" not found`, isError: true };

  const target = await repository.getEntityByName(targetName);
  if (!target) return { toolCallId: toolCall.id, content: `Target entity "${targetName}" not found`, isError: true };

  const link = await repository.createLink({
    source_id: source.id!,
    target_id: target.id!,
    relation,
  });

  return { toolCallId: toolCall.id, content: `Link created: ${sourceName} --[${relation}]--> ${targetName} (id: ${link.id})` };
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
      case 'list_entities':
        return await handleListEntities(toolCall);
      case 'get_entity_claims':
        return await handleGetEntityClaims(toolCall);
      case 'create_link':
        return await handleCreateLink(toolCall);
      default:
        return { toolCallId: toolCall.id, content: `Unknown tool: ${toolCall.name}`, isError: true };
    }
  } catch (err) {
    logger.error('Tool execution failed', { tool: toolCall.name, error: err });
    return { toolCallId: toolCall.id, content: String(err), isError: true };
  }
}
