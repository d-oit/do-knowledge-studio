import { useState, useCallback, useRef, useEffect } from 'react';
import { loadConfig, createProvider } from '../../lib/llm/config';
import type { LLMMessage } from '../../lib/llm/types';
import { BUILT_IN_TOOLS } from '../../lib/llm/tool-registry';
import { executeTool } from '../../lib/llm/tool-executor';
import { searchKnowledge } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';

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

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'initial', role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSourcing, setIsSourcing] = useState(false);
  const [resolvedSources, setResolvedSources] = useState<ResolvedContent[]>([]);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ input: 0, output: 0 });

  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (
    userMessage: string,
    useContext: boolean,
    activeModel?: string
  ) => {
    if (!userMessage.trim() || isLoading) return;

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
        const searchResults = await searchKnowledge(userMessage);
        if (searchResults.length > 0) {
          contextString = "\n\nRelevant local context:\n" + searchResults.map(r => "[" + r.type + "] " + r.title + ": " + r.content.slice(0, 200)).join('\n');
        }
      }

      const currentConfig = await loadConfig();
      const provider = createProvider(currentConfig);

      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = activeModel || providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      const systemMessage: LLMMessage = {
        role: 'system',
        content: 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible. When external URLs are provided, analyze their content thoroughly and cite specific details. Mark sources clearly in your response.',
      };

      let promptMessages: LLMMessage[] = [
        systemMessage,
        ...messagesRef.current.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString + externalContent },
      ];

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

        for (let i = 0; i < response.toolCalls.length; i++) {
          const tc = response.toolCalls[i]; /* nosemgrep: js/object-injection-sink */
          const tr = toolResults[i]; /* nosemgrep: js/object-injection-sink */
          accumulatedToolCalls.push({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
            result: tr.content,
            isError: tr.isError,
          });
        }

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
  }, [isLoading]);

  return {
    messages,
    isLoading,
    isSourcing,
    resolvedSources,
    sessionTokens,
    sendMessage,
    setResolvedSources,
  };
}
