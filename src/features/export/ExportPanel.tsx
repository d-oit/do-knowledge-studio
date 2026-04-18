import React from 'react';

const ExportPanel: React.FC = () => (
  <div className="editor-container">
    <h2>Export</h2>
    <p>Export your knowledge base to various formats.</p>
    <div className="toolbar">
      <button className="primary">Export as Markdown</button>
      <button>Export as JSON</button>
      <button>Export as Static Site</button>
    </div>
  </div>
);

export default ExportPanel;
