import React from 'react';

const AIHarness: React.FC = () => (
  <div className="chat-view">
    <h2>AI Harness</h2>
    <div className="messages-list">
      <div className="message assistant">
        AI agent ready to assist with TRIZ analysis and knowledge synthesis.
      </div>
    </div>
    <div className="chat-controls">
      <input type="text" placeholder="Ask the AI agent..." />
      <button className="primary">Send</button>
    </div>
  </div>
);

export default AIHarness;
