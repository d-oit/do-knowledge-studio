import React, { useState } from 'react';
import { searchKnowledge, RankedResult } from '../../lib/search';
import { logger } from '../../lib/logger';
import { Search } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsSearching(true);

    try {
      const results = await searchKnowledge(currentInput);

      let response = `I found ${results.length} relevant items in your local knowledge base.`;
      if (results.length > 0) {
        response += '\n\nResults:\n' + results.slice(0, 5).map((r: RankedResult) => `- ${r.name} (${r.type}): ${r.excerpt}`).join('\n');
        if (results.length > 5) response += `\n\n(Plus ${results.length - 5} more...)`;
      } else {
        response += '\n\nTry searching for different keywords or create new entities in the Editor.';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      logger.error('Chat search failed', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error retrieving local context.' }]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="chat-view">
      <div className="messages-list">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>Ask anything about your local knowledge base. The assistant uses local search to find context.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <strong>{m.role === 'user' ? 'You' : 'Studio'}</strong>
            <div className="msg-content">{m.content}</div>
          </div>
        ))}
        {isSearching && (
          <div className="message assistant" aria-live="polite">
            <div className="msg-content searching-status">Searching local database...</div>
          </div>
        )}
      </div>
      <div className="chat-controls">
        <div className="input-wrapper">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <label htmlFor="chat-input" className="sr-only">Search entities or ask questions</label>
          <input
            id="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Search or ask..."
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isSearching}
          />
        </div>
        <button className="primary" onClick={handleSend} disabled={isSearching || !input.trim()}>
          {isSearching ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default Chat;
