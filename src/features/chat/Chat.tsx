import React, { useState } from 'react';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Chat: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const entities = await repository.getAllEntities();
      const relevant = entities.filter(e =>
        e.name.toLowerCase().includes(input.toLowerCase())
      );

      let response = `I found ${relevant.length} relevant entities in your knowledge base.`;
      if (relevant.length > 0) {
        response += '\n\nSources:\n' + relevant.map(e => `- ${e.name}`).join('\n');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      logger.error('Chat context building failed', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error retrieving local context.' }]);
    }
  };

  return (
    <div className="chat-view">
      <div className="messages-list">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>Ask anything about your local knowledge base.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <strong>{m.role === 'user' ? 'You' : 'Studio'}</strong>
            <div className="msg-content">{m.content}</div>
          </div>
        ))}
      </div>
      <div className="chat-controls">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask your knowledge base..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="primary" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
