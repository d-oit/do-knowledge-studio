import React, { useState } from 'react';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { generateSiteHtml, generateMarkdownExport, generateJsonExport } from '../../lib/export-core';
import type { ExportData } from '../../lib/export-core';
import { Download, FileJson, FileText, Globe, Loader2 } from 'lucide-react';

const ExportPanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const [entities, claims, notes] = await Promise.all([
        repository.getAllEntities(),
        repository.getAllClaimsGroupedByEntity(),
        repository.getAllNotesGroupedByEntity(),
      ]);
      const data: ExportData = { entities, claims, notes };
      const content = generateMarkdownExport(data);
      downloadFile(content, 'knowledge-base.md', 'text/markdown');
      logger.info('Markdown export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Markdown export failed';
      setError(msg);
      logger.error('Markdown export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const [entities, links, claims, notes] = await Promise.all([
        repository.getAllEntities(),
        repository.getAllLinks(),
        repository.getAllClaimsGroupedByEntity(),
        repository.getAllNotesGroupedByEntity(),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        entities,
        claims,
        notes,
        links,
      };
      const content = generateJsonExport(data);
      downloadFile(content, 'knowledge-base.json', 'application/json');
      logger.info('JSON export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JSON export failed';
      setError(msg);
      logger.error('JSON export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSite = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const [entities, claims] = await Promise.all([
        repository.getAllEntities(),
        repository.getAllClaimsGroupedByEntity(),
      ]);
      const data: ExportData = { entities, claims, notes: {} };
      const content = generateSiteHtml(data);
      downloadFile(content, 'knowledge-base.html', 'text/html');
      logger.info('Site export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Site export failed';
      setError(msg);
      logger.error('Site export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="editor-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Download size={24} />
        <h2 style={{ margin: 0 }}>Export Knowledge</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        Generate portable versions of your knowledge base. All exports are processed entirely in your browser.
      </p>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}
      
      <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <button 
          className="primary" 
          onClick={handleExportMarkdown} 
          disabled={isExporting}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
          Export as Markdown
        </button>
        <button 
          onClick={handleExportJson} 
          disabled={isExporting}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileJson size={20} />}
          Export as JSON
        </button>
        <button 
          onClick={handleExportSite} 
          disabled={isExporting}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
          Export as Static Site
        </button>
      </div>

      {isExporting && (
        <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--interactive-primary)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto 8px' }} />
          <p>Processing your knowledge base...</p>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;

