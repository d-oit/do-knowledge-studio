import React, { useState, useRef, useEffect } from 'react';
import { loadConfig, createProvider } from '../../lib/llm/config';
import { searchKnowledge } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Send, Loader2, Bot, User, Database } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user' | 'system';
  content: string;
}

const AIHarness: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'AI agent ready to assist with TRIZ analysis and knowledge synthesis. Ask me anything about your local knowledge base.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      let contextString = '';
      if (useContext) {
        const results = await searchKnowledge(userMessage);
        if (results.length > 0) {
          contextString = "\n\nRelevant local context:\n" + results.map(r => `[${r.type}] ${r.name}: ${r.excerpt}`).join('\n');
        }
      }

      const config = loadConfig();
      const provider = createProvider(config);
      
      const promptMessages: Message[] = [
        { role: 'system', content: 'You are a helpful knowledge assistant. Ground your answers in the provided context whenever possible.' },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextString }
      ];

      // Use streaming for better UX
      const model = config.activeProvider === 'openrouter'
        ? 'google/gemini-2.0-flash-lite-preview-02-05:free'
        : 'meta-llama/llama-3.1-8b-instruct';

      let streamedContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const stream = provider.chatStream({
        model,
        messages: promptMessages,
        temperature: 0.7,
        maxTokens: 1000
      });

      for await (const chunk of stream) {
        if (chunk.done) break;
        streamedContent += chunk.content;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent };
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
  };

  return (
    <div className="chat-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>AI Harness</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked={useContext} onChange={e => setUseContext(e.target.checked)} />
          <Database size={16} /> Augment with Local Knowledge
        </label>
      </div>

      <div className="messages-list">
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontWeight: 'bold', fontSize: '12px' }}>
              {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
              {m.role === 'assistant' ? 'Assistant' : 'You'}
            </div>
            {m.content}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <Loader2 className="animate-spin" size={16} /> Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-controls">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask the AI agent..." 
          disabled={isLoading}
        />
        <button className="primary" onClick={handleSend} disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
};

export default AIHarness;

