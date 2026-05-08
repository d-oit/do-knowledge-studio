import React, { useState } from 'react';

const AIHarness: React.FC = () => {
  const [activePanel, setActivePanel] = useState<'prompt' | 'context' | 'log' | 'artifacts'>('prompt');

  return (
    <div className="ai-harness-view">
      <div className="ai-harness-header">
        <div className="header-main">
          <h2>AI Harness</h2>
          <span className="experimental-badge">Experimental Lab</span>
        </div>
        <div className="model-status-banner">
          <span className="status-dot warning"></span>
          <span className="status-text">Local model unavailable. Configure provider in settings.</span>
        </div>
      </div>

      <div className="harness-layout">
        <nav className="harness-tabs">
          <button
            className={activePanel === 'prompt' ? 'active' : ''}
            onClick={() => setActivePanel('prompt')}
          >
            Prompt
          </button>
          <button
            className={activePanel === 'context' ? 'active' : ''}
            onClick={() => setActivePanel('context')}
          >
            Context
          </button>
          <button
            className={activePanel === 'log' ? 'active' : ''}
            onClick={() => setActivePanel('log')}
          >
            Run Log
          </button>
          <button
            className={activePanel === 'artifacts' ? 'active' : ''}
            onClick={() => setActivePanel('artifacts')}
          >
            Artifacts
          </button>
        </nav>

        <div className="harness-content">
          {activePanel === 'prompt' && (
            <div className="panel prompt-panel">
              <div className="panel-header">
                <h3>System & User Prompt</h3>
              </div>
              <textarea
                className="prompt-editor"
                placeholder="Enter prompt templates..."
                disabled
              />
              <div className="panel-footer">
                <button className="primary" disabled>
                  Execute Chain (Behavior Pending)
                </button>
              </div>
            </div>
          )}

          {activePanel === 'context' && (
            <div className="panel context-panel">
              <div className="panel-header">
                <h3>Retrieved Context</h3>
              </div>
              <div className="empty-panel-state">
                No context retrieved. Run a chain to see RAG results.
              </div>
            </div>
          )}

          {activePanel === 'log' && (
            <div className="panel log-panel">
              <div className="panel-header">
                <h3>Execution Trace</h3>
              </div>
              <div className="log-entries">
                <div className="log-entry info">Lab environment initialized.</div>
                <div className="log-entry warning">Waiting for model configuration...</div>
              </div>
            </div>
          )}

          {activePanel === 'artifacts' && (
            <div className="panel artifacts-panel">
              <div className="panel-header">
                <h3>Generated Artifacts</h3>
              </div>
              <div className="empty-panel-state">
                No artifacts generated in this session.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIHarness;
