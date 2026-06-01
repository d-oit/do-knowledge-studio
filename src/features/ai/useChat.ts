import { useState, useCallback } from 'react';
import { loadConfig, createProvider } from '../../lib/llm/config';
import { searchKnowledge } from '../../lib/search';
import { resolveUrl, ResolvedContent } from '../../lib/resolver';
import { logger } from '../../lib/logger';

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

export interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
  tokenUsage?: { input: number; output: number };
}

export interface TokenUsage {
  input: number;
  output: number;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base, or paste URLs to have me fetch and analyze external content.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSourcing, setIsSourcing] = useState(false);
  const [resolvedSources, setResolvedSources] = useState<ResolvedContent[]>([]);
  const [sessionTokens, setSessionTokens] = useState<TokenUsage>({ input: 0, output: 0 });

  const sendMessage = useCallback(async (
    userMessage: string,
    useContext: boolean,
    activeModel?: string
  ) => {
    if (!userMessage.trim() || isLoading) return;

    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
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
            const header = s.title ? `# ${s.title}` : `Source: ${s.url}`;
            return `${header}\nURL: ${s.url}\nProvider: ${s.provider}\nContent: ${s.content.slice(0, 3000)}`;
          }).join('\n\n---\n\n');
        }
      }

      if (useContext) {
        const results = await searchKnowledge(userMessage);
        if (results.length > 0) {
          contextString = "\n\nRelevant local context:\n" + results.map(r => `[${r.type}] ${r.name}: ${r.excerpt}`).join('\n');
        }
      }

      const currentConfig = loadConfig();
      const provider = createProvider(currentConfig);

      const promptMessages: Message[] = [
        { role: 'system', content: 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible. When external URLs are provided, analyze their content thoroughly and cite specific details. Mark sources clearly in your response.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString + externalContent }
      ];

      const providerConfig = currentConfig.providers[currentConfig.activeProvider];
      const model = activeModel || providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      let streamedContent = '';
      let streamUsage: { input: number; output: number } | undefined;
      setMessages(prev => [...prev, { role: 'assistant', content: '', tokenUsage: undefined }]);

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
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
          return updated;
        });
      }

      if (streamUsage) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent, tokenUsage: streamUsage };
          return updated;
        });
      }
    } catch (err) {
      logger.error('AI chat failed', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error while processing your request.' };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

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
