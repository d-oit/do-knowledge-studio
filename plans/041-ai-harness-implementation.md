# Implementation Plan: 4.1 AI Harness Integration

> **Historical Note**: This plan references the retired AI harness architecture (superseded by ADR 025 — OpenRouter + Ollama consolidation, 2026-07). Remaining unchecked items were completed in later plans (090–096). Retained for historical context only.

**Date**: 2026-06-25
**Priority**: P0 (highest user value)
**Estimated Effort**: 6-8h (3 waves)
**Status**: Plan 04 unheld

---

## Current State Analysis

The AI Harness is **already substantially functional**:
- ✅ Provider selection (OpenRouter, Kilo, Anthropic, Ollama) with model dropdowns
- ✅ API key management with AES-GCM encryption at rest
- ✅ Streaming responses via `chatStream()` with real-time rendering
- ✅ Orama context augmentation (top 3 results injected into system prompt)
- ✅ Agentic tool-call loop (up to 5 rounds) with `search_knowledge`, `create_note`, `add_graph_node`, `get_current_note`
- ✅ Rate limiting (15 req/min window)
- ✅ Chat history persistence via IndexedDB
- ✅ Settings wizard for first-time setup
- ✅ URL resolution (Jina AI reader) for external content
- ✅ Markdown rendering in responses
- ✅ Token usage tracking

### What's Missing

| Gap | Description | Impact |
|-----|-------------|--------|
| Weak system prompt | Generic "helpful knowledge assistant" — doesn't leverage local KB structure | Medium |
| Limited context injection | Only injects raw search snippets, no entity/claim structure | Medium |
| No entity-aware tools | Can't list entities, query claims, create links between entities | High |
| No TRIZ-specific tools | Contradiction matrix, inventive principles (from plan 04 spec) | Low (future) |
| No clear chat/reset affordance | Users can't clear conversation or see context status | Low |
| Inline styles throughout | `AIHarness.tsx` uses raw `style={{}}` instead of design tokens | Low |

---

## Implementation Waves

### Wave 1: Enhanced Context & System Prompt (2-3h)

**Goal**: Make the AI actually understand and leverage the knowledge base structure.

#### 1.1 Enhanced System Prompt

**File**: `src/features/ai/useChat.ts` (line 164)

Replace the generic system prompt with a structured prompt that:
- Describes the knowledge base schema (entities, claims, links, notes)
- Instructs the model to ground responses in local context
- Provides guidance on when to use tools
- Explains the entity/claim/link model

```typescript
const SYSTEM_PROMPT = `You are the Knowledge Studio AI agent. You help users analyze, connect, and synthesize information from their local knowledge base.

## Knowledge Base Structure
- **Entities**: Named concepts, people, organizations, technologies (with type and description)
- **Claims**: Statements about entities with source, evidence, confidence, and verification status
- **Links**: Relationships between entities (e.g., "invented", "relates_to", "contradicts")
- **Notes**: Free-form content attached to entities

## Your Capabilities
- Search the knowledge base for relevant entities, claims, and notes
- Create new notes and entities
- Add nodes to the knowledge graph
- Fetch and analyze external URLs
- Read the currently active note in the editor

## Guidelines
- Always ground your answers in local knowledge when available
- Cite specific entities and claims by name
- When suggesting connections, reference existing links or propose new ones
- For TRIZ analysis, identify contradictions between claims and suggest inventive principles
- When external URLs are provided, analyze them and compare with local knowledge`;
```

#### 1.2 Structured Context Injection

**File**: `src/features/ai/useChat.ts` (lines 154-158)

Replace raw snippet injection with structured context:

```typescript
// Instead of just search snippets, build structured context
const buildStructuredContext = (results: RankedResult[]): string => {
  if (results.length === 0) return '';

  const entities = results.filter(r => r.type === 'entity');
  const claims = results.filter(r => r.type === 'claim');
  const notes = results.filter(r => r.type === 'note');

  const parts: string[] = [];

  if (entities.length > 0) {
    parts.push('### Relevant Entities');
    for (const e of entities) {
      parts.push(`- **${e.title}** (${e.type}): ${e.content}`);
    }
  }

  if (claims.length > 0) {
    parts.push('### Relevant Claims');
    for (const c of claims) {
      parts.push(`- [${c.stage}] ${c.title}: ${c.content}`);
    }
  }

  if (notes.length > 0) {
    parts.push('### Relevant Notes');
    for (const n of notes) {
      parts.push(`- ${n.title}: ${n.content.slice(0, 200)}`);
    }
  }

  return '\n\nRelevant local knowledge:\n' + parts.join('\n');
};
```

#### 1.3 Top-N Context Increase

**File**: `src/features/ai/useChat.ts` (line 155)

Change `searchKnowledge(userMessage)` to use `limit: 5` instead of default 20, and filter for highest-quality results:

```typescript
const searchResults = await searchKnowledge(userMessage, { limit: 5 });
```

**Files to modify**:
- `src/features/ai/useChat.ts`

---

### Wave 2: Entity-Aware Tools (3-4h)

**Goal**: Give the AI richer access to the knowledge base.

#### 2.1 New Tool: `list_entities`

**File**: `src/lib/llm/tool-registry.ts`

Add a tool to list/search entities with filters:

```typescript
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
}
```

**File**: `src/lib/llm/tool-executor.ts`

Add handler:

```typescript
async function handleListEntities(toolCall: ToolCall): Promise<ToolResult> {
  const query = toolCall.arguments.query as string | undefined;
  const type = toolCall.arguments.type as string | undefined;
  const limit = (toolCall.arguments.limit as number | undefined) ?? 10;

  let entities;
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
```

#### 2.2 New Tool: `get_entity_claims`

**File**: `src/lib/llm/tool-registry.ts`

Add a tool to retrieve claims for a specific entity:

```typescript
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
}
```

**File**: `src/lib/llm/tool-executor.ts`

Add handler:

```typescript
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
```

#### 2.3 New Tool: `create_link`

**File**: `src/lib/llm/tool-registry.ts`

Add a tool to create relationships between entities:

```typescript
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
}
```

**File**: `src/lib/llm/tool-executor.ts`

Add handler:

```typescript
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
```

#### 2.4 Update Tool Executor Switch

**File**: `src/lib/llm/tool-executor.ts` (line 60)

Add cases for the new tools in the switch statement.

**Files to modify**:
- `src/lib/llm/tool-registry.ts`
- `src/lib/llm/tool-executor.ts`

---

### Wave 3: UI Polish & Tests (1-2h)

**Goal**: Clean up inline styles, add reset affordance, write tests.

#### 3.1 Add Clear Chat Button

**File**: `src/features/ai/ChatView.tsx`

Add a "Clear chat" button to the chat controls footer. Wire it to `clearHistory` from `useChat`.

**File**: `src/features/ai/AIHarness.tsx`

Pass `clearHistory` through to ChatView.

#### 3.2 Move Inline Styles to CSS Classes

**File**: `src/features/ai/AIHarness.tsx`

Replace `style={{}}` with CSS classes using design tokens:
- `.ai-harness-header` for the flex header
- `.ai-harness-warning` for the API key warning
- `.ai-harness-settings` for the settings panel
- `.ai-harness-form` for form elements

**File**: `src/styles/index.css` (or a new `src/styles/ai-harness.css` imported from index)

Add the corresponding CSS rules.

#### 3.3 Tests

**File**: `src/lib/llm/__tests__/tool-executor.test.ts`

Add tests for new tools:
- `list_entities` — search, type filter, empty results
- `get_entity_claims` — by id, by name, not found
- `create_link` — success, entity not found

**File**: `src/features/ai/__tests__/AIHarness.test.tsx`

Add tests for:
- Clear chat button appears and works
- Context toggle state

**Files to modify**:
- `src/features/ai/ChatView.tsx`
- `src/features/ai/AIHarness.tsx`
- `src/styles/index.css`
- `src/lib/llm/__tests__/tool-executor.test.ts`
- `src/features/ai/__tests__/AIHarness.test.tsx`

---

## File Summary

| File | Change | LOC Delta |
|------|--------|-----------|
| `src/features/ai/useChat.ts` | Enhanced system prompt + structured context | +30 |
| `src/lib/llm/tool-registry.ts` | 3 new tool definitions | +45 |
| `src/lib/llm/tool-executor.ts` | 3 new handlers + switch cases | +65 |
| `src/features/ai/ChatView.tsx` | Clear chat button | +10 |
| `src/features/ai/AIHarness.tsx` | Pass clearHistory, CSS classes | +5 |
| `src/styles/index.css` | AI harness CSS classes | +30 |
| `src/lib/llm/__tests__/tool-executor.test.ts` | Tests for new tools | +60 |
| `src/features/ai/__tests__/AIHarness.test.tsx` | UI tests | +20 |

**Total**: ~265 lines added, ~20 lines changed

---

## Definition of Done

- [ ] System prompt describes KB schema and instructs grounding
- [ ] Context injection includes entity/claim/note structure
- [ ] `list_entities` tool works (search + type filter)
- [ ] `get_entity_claims` tool works (by id + by name)
- [ ] `create_link` tool works (validates entities exist)
- [ ] Clear chat button works
- [ ] Inline styles replaced with CSS classes
- [ ] All new tools have unit tests
- [ ] `pnpm run lint` passes
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run test` passes
- [ ] `pnpm run build` passes

---

## Future Work (Not in Scope)

- **TRIZ-specific tools** (contradiction matrix, inventive principles) — requires TRIZ data model
- **Claim creation tool** — complex (needs entity_id resolution, confidence setting)
- **Multi-turn tool context** — tool results carry over across messages
