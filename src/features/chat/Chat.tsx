import React, { useState } from 'react';
import { repository } from '../../db/repository';
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
      const relevant = await repository.searchEntities(currentInput);

      let response = `I found ${relevant.length} relevant entities in your local knowledge base.`;
      if (relevant.length > 0) {
        response += '\n\nResults:\n' + relevant.map(e => `- ${e.name} (${e.type})`).join('\n');
      } else {
        response += '\n\nTry searching for different keywords or create new entities in the Editor.';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      logger.error('Chat context building failed', err);
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
            <div className="msg-content searching">Searching local database...</div>
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
            placeholder="Search entities or ask questions..."
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
