import { useState, useCallback, useRef, useEffect } from 'react';
import { loadConfig, createProvider } from '../../lib/llm/config';
import { LLMMessage } from '../../lib/llm/types';
import { searchKnowledge } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../../lib/chat-persistence';

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^[\]]+/gi;

export interface Message {
  id: string;
  role: 'assistant' | 'user' | 'system';
  content: string;
  tokenUsage?: { input: number; output: number };
}

export interface TokenUsage {
  input: number;
  output: number;
}

const WELCOME_MESSAGE: Message = { id: 'initial', role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' };

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

      const systemPrompt = 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible. When external URLs are provided, analyze their content thoroughly and cite specific details. Mark sources clearly in your response.';
      const userContent = userMessage + contextString + externalContent;

      const promptMessages = buildBudgetedMessages(
        messagesRef.current,
        systemPrompt,
        userContent,
        MAX_CONTEXT_TOKENS
      );

      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = activeModel || providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      let streamedContent = '';
      let streamUsage: { input: number; output: number } | undefined;
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', tokenUsage: undefined }]);

      const stream = provider.chatStream({
        model,
        messages: promptMessages,
        temperature: 0.7,
        maxTokens: 1000
      });

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
    clearHistory: useCallback(async () => {
      await clearChatHistory();
      setMessages([WELCOME_MESSAGE]);
    }, []),
  };
}
