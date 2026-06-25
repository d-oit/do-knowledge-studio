import { useState, useCallback, useRef, useEffect } from 'react';
import { loadConfig, createProvider } from '../../lib/llm/config';
import type { LLMMessage } from '../../lib/llm/types';
import { BUILT_IN_TOOLS } from '../../lib/llm/tool-registry';
import { executeTool } from '../../lib/llm/tool-executor';
import { searchKnowledge, type RankedResult } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../../lib/chat-persistence';
import { useRateLimiter } from './useRateLimiter';

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^[\]]+/gi;
const MAX_TOOL_ROUNDS = 5;

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  tokenUsage?: { input: number; output: number };
  toolCalls?: ToolCallRecord[];
}

export interface TokenUsage {
  input: number;
  output: number;
}

const WELCOME_MESSAGE: Message = { id: 'initial', role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' };

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

const MAX_CONTEXT_TOKENS = 6000;
const CHARS_PER_TOKEN = 4;

const estimateTokens = (text: string): number =>
  Math.ceil(text.length / CHARS_PER_TOKEN);

const buildBudgetedMessages = (
  messages: Message[],
  systemPrompt: string,
  userContent: string,
  maxTokens: number
): LLMMessage[] => {
  const systemTokens = estimateTokens(systemPrompt);
  const userTokens = estimateTokens(userContent);
  const reservedTokens = systemTokens + userTokens + 200;
  const budgetForHistory = Math.max(0, maxTokens - reservedTokens);

  const historyMessages: LLMMessage[] = [];
  let usedTokens = 0;

  const reversed = [...messages].reverse();
  for (const msg of reversed) {
    const tokens = estimateTokens(msg.content);
    if (usedTokens + tokens > budgetForHistory) break;
    historyMessages.unshift({ role: msg.role, content: msg.content });
    usedTokens += tokens;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: userContent },
  ];
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSourcing, setIsSourcing] = useState(false);
  const [resolvedSources, setResolvedSources] = useState<ResolvedContent[]>([]);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ input: 0, output: 0 });

  const { trackRequest, getRateLimitLevel } = useRateLimiter();

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load persisted chat history on mount
  useEffect(() => {
    loadChatHistory().then(history => {
      if (history.length > 0) {
        setMessages(history);
      }
    }).catch((err: unknown) => { logger.warn('Failed to load chat history', { error: err }); });
  }, []);

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length > 1) {
      saveChatHistory(messages).catch((err: unknown) => { logger.warn('Failed to save chat history', { error: err }); });
    }
  }, [messages]);

  const sendMessage = useCallback(async (
    userMessage: string,
    useContext: boolean,
    activeModel?: string
  ) => {
    if (!userMessage.trim() || isLoading) return;

    // Check rate limit
    const rateLevel = getRateLimitLevel();
    if (rateLevel === 'high') {
      logger.warn('Rate limit reached, request throttled');
      return;
    }

    trackRequest();
    setIsLoading(true);
    const userMsgId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: userMessage }]);
    setResolvedSources([]);

    try {
      let contextString = '';
      let externalContent = '';

      const urls = userMessage.match(URL_REGEX);
      if (urls && urls.length > 0) {
        setIsSourcing(true);
        const uniqueUrls = [...new Set(urls.map(u => u.replace(/[.,;:!?)]+$/, '')))];
        const urlsToFetch = uniqueUrls.slice(0, 3);

        const results = await Promise.allSettled(urlsToFetch.map(url => resolveUrl(url)));
        const sources: ResolvedContent[] = [];
        for (const result of results) {
          if (result.status === 'fulfilled') {
            sources.push(result.value);
          } else {
            logger.warn('Failed to resolve URL for RAG', { err: String(result.reason) });
          }
        }

        setResolvedSources(sources);
        setIsSourcing(false);

        if (sources.length > 0) {
          externalContent = "\n\nExternal source content:\n" + sources.map(s => {
            const header = s.title ? "# " + s.title : "Source: " + s.url;
            return header + "\nURL: " + s.url + "\nProvider: " + s.provider + "\nContent: " + s.content.slice(0, 3000);
          }).join('\n\n---\n\n');
        }
      }

      if (useContext) {
        const searchResults = await searchKnowledge(userMessage, { limit: 5 });
        if (searchResults.length > 0) {
          contextString = buildStructuredContext(searchResults);
        }
      }

      const currentConfig = await loadConfig();
      const provider = createProvider(currentConfig);

      const systemPrompt = SYSTEM_PROMPT;
      const userContent = userMessage + contextString + externalContent;

      let promptMessages = buildBudgetedMessages(
        messagesRef.current,
        systemPrompt,
        userContent,
        MAX_CONTEXT_TOKENS
      );

      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = activeModel || providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      // --- Agentic tool-call loop ---
      const assistantId = crypto.randomUUID();
      const accumulatedToolCalls: ToolCallRecord[] = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await provider.chat({
          model,
          messages: promptMessages,
          temperature: 0.7,
          maxTokens: 1000,
          tools: BUILT_IN_TOOLS,
        });

        if (!response.toolCalls?.length) {
          // No more tool calls — stream the final answer
          let streamedContent = '';
          let streamUsage: { input: number; output: number } | undefined;
          setMessages(prev => [
            ...prev,
            {
              id: assistantId,
              role: 'assistant',
              content: '',
              toolCalls: accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined,
            },
          ]);

          const stream = provider.chatStream({ model, messages: promptMessages, temperature: 0.7, maxTokens: 1000 });
          for await (const chunk of stream) {
            if (chunk.done) {
              if (chunk.usage) {
                streamUsage = { input: chunk.usage.inputTokens, output: chunk.usage.outputTokens };
                setSessionTokens(prev => ({
                  input: prev.input + chunk.usage.inputTokens,
                  output: prev.output + chunk.usage.outputTokens,
                }));
              }
              break;
            }
            const content: string = chunk.content;
            streamedContent += content;
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.id === assistantId) {
                updated[updated.length - 1] = { ...last, content: streamedContent };
              }
              return updated;
            });
          }

          if (streamUsage) {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last && last.id === assistantId) {
                updated[updated.length - 1] = { ...last, content: streamedContent, tokenUsage: streamUsage };
              }
              return updated;
            });
          }
          break;
        }

        // Execute tool calls and collect results
        const toolResults = await Promise.all(
          response.toolCalls.map(tc =>
            executeTool(tc, { search: searchKnowledge })
          )
        );

        response.toolCalls.forEach((tc, i) => {
          const tr = toolResults[i];
          const rec: ToolCallRecord = { id: tc.id, name: tc.name, arguments: tc.arguments, result: tr.content, isError: tr.isError };
          accumulatedToolCalls.push(rec);
        });

        // Append assistant tool-call message + tool result messages for next round
        promptMessages = [
          ...promptMessages,
          { role: 'assistant', content: response.content, tool_calls: response.toolCalls },
          ...toolResults.map(tr => ({
            role: 'tool' as const,
            content: tr.content,
            tool_call_id: tr.toolCallId,
          })),
        ];
      }
    } catch (err) {
      logger.error('AI chat failed', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
           updated[updated.length - 1] = { ...last, content: 'Sorry, I encountered an error while processing your request.' };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, getRateLimitLevel, trackRequest]);

  return {
    messages,
    isLoading,
    isSourcing,
    resolvedSources,
    sessionTokens,
    sendMessage,
    setResolvedSources,
    clearHistory: useCallback(async () => {
      await clearChatHistory();
      setMessages([WELCOME_MESSAGE]);
    }, []),
  };
}
