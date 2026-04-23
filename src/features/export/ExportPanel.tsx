import React, { useEffect } from 'react';
import { jobCoordinator } from '../../lib/jobs';
import { logger } from '../../lib/logger';

const ExportPanel: React.FC = () => {
  useEffect(() => {
    jobCoordinator.registerHandler('prepare-export', async (payload) => {
      const { format } = payload as { format: string };
      logger.info(`Preparing export for format: ${format}`);
      // Simulate expensive work
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info(`Export prepared: ${format}`);
    });
  }, []);

  const handleExport = (format: string) => {
    jobCoordinator.enqueue('prepare-export', format, { format });
  };

  return (
    <div className="editor-container">
      <h2>Export</h2>
      <p>Export your knowledge base to various formats.</p>
      <div className="toolbar">
        <button className="primary" onClick={() => handleExport('markdown')}>Export as Markdown</button>
        <button onClick={() => handleExport('json')}>Export as JSON</button>
        <button onClick={() => handleExport('site')}>Export as Static Site</button>
      </div>
    </div>
  );
};

export default ExportPanel;
