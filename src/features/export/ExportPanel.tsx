import React, { useState, useEffect } from 'react';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { generateSiteHtml, generateMarkdownExport, generateJsonExport, fetchAllExportData } from '../../lib/export-core';
import { stripHtmlTags } from '../../lib/security';
import { Download, File, FileJson, FileText, FileSpreadsheet, Globe, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Entity } from '../../lib/validation';

const ExportPanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clear the success message after a few seconds so the panel doesn't
  // accumulate stale "Exported!" notes from previous runs.
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [success]);

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
      const data = await fetchAllExportData(repository);
      const content = generateMarkdownExport(data);
      downloadFile(content, 'knowledge-base.md', 'text/markdown');
      setSuccess('knowledge-base.md downloaded');
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
      const data = await fetchAllExportData(repository);
      const content = generateJsonExport(data);
      downloadFile(content, 'knowledge-base.json', 'application/json');
      setSuccess('knowledge-base.json downloaded');
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
      const data = await fetchAllExportData(repository);
      const content = generateSiteHtml(data);
      downloadFile(content, 'knowledge-base.html', 'text/html');
      setSuccess('knowledge-base.html downloaded');
      logger.info('Site export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Site export failed';
      setError(msg);
      logger.error('Site export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const data = await fetchAllExportData(repository);
      const { exportAllNotesToPDF, writePdfBlobToFile } = await import('./pdf-exporter');
      const notes = Object.values(data.notes ?? {}).flatMap(n => n ?? []);
      const blob = await exportAllNotesToPDF(notes, data.entities, { title: 'Knowledge Base Export' });
      writePdfBlobToFile(blob, 'knowledge-base.pdf');
      setSuccess('knowledge-base.pdf downloaded');
      logger.info('PDF export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF export failed';
      setError(msg);
      logger.error('PDF export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDOCX = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const data = await fetchAllExportData(repository);
      const { Document, Packer, Paragraph, HeadingLevel } = await import('docx');

      const doc = new Document({
        title: 'Knowledge Base Export',
        sections: [{
          children: [
            new Paragraph({ text: 'Knowledge Base Export', heading: HeadingLevel.TITLE }),
            new Paragraph({ text: `Exported on ${new Date().toLocaleString()}`, spacing: { after: 400 } }),
            ...data.entities.filter((e): e is Entity & Required<Pick<Entity, 'id'>> => !!e.id).flatMap(entity => {
              const entityClaims = data.claims[entity.id] ?? [];
              return [
                new Paragraph({ text: stripHtmlTags(entity.name), heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: `Type: ${stripHtmlTags(entity.type)}`, spacing: { after: 200 } }),
                ...(entity.description ? [new Paragraph({ text: stripHtmlTags(entity.description), spacing: { after: 200 } })] : []),
                ...(entityClaims.length > 0 ? [
                  new Paragraph({ text: 'Claims', heading: HeadingLevel.HEADING_2 }),
                  ...entityClaims.map(claim => new Paragraph({
                    text: `• ${stripHtmlTags(claim.statement)}${claim.confidence !== 1 ? ` (confidence: ${Math.round(claim.confidence * 100)}%)` : ''}`,
                    spacing: { after: 100 },
                  })),
                ] : []),
              ];
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'knowledge-base.docx';
      link.click();
      URL.revokeObjectURL(url);
      setSuccess('knowledge-base.docx downloaded');
      logger.info('DOCX export complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DOCX export failed';
      setError(msg);
      logger.error('DOCX export failed', err);
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
        <div role="alert" aria-live="assertive" style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {success && (
        <div
          key={success}
          role="status"
          aria-live="polite"
          className="export-success"
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#dcfce7',
            color: '#065f46',
            borderRadius: '8px',
            border: '1px solid #bdf0d2',
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          {success}
        </div>
      )}
      
      <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <button 
          className="primary" 
          onClick={() => void handleExportMarkdown()} 
          disabled={isExporting}
          aria-label="Export knowledge base as Markdown"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
          Export as Markdown
        </button>
        <button 
          onClick={() => void handleExportJson()} 
          disabled={isExporting}
          aria-label="Export knowledge base as JSON"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileJson size={20} />}
          Export as JSON
        </button>
        <button 
          onClick={() => void handleExportSite()} 
          disabled={isExporting}
          aria-label="Export knowledge base as static HTML site"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Globe size={20} />}
          Export as Static Site
        </button>
        <button 
          onClick={() => void handleExportPDF()} 
          disabled={isExporting}
          aria-label="Export knowledge base as PDF"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <File size={20} />}
          Export as PDF
        </button>
        <button 
          onClick={() => void handleExportDOCX()} 
          disabled={isExporting}
          aria-label="Export knowledge base as DOCX"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px' }}
        >
          {isExporting ? <Loader2 className="animate-spin" size={20} /> : <FileSpreadsheet size={20} />}
          Export as DOCX
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

