import React, { useState } from 'react';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';
import { Claim, Note } from '../../lib/validation';
import { sanitizeHtml, escapeHtml } from '../../lib/security';
import { Download, FileJson, FileText, Globe, Loader2 } from 'lucide-react';

const ExportPanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);

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
    try {
      const entities = await repository.getAllEntities();
      let fullContent = '';
      
      for (const entity of entities) {
        if (!entity.id) continue;
        const claims = await repository.getClaimsByEntityId(entity.id);
        const notes = await repository.getNotesByEntityId(entity.id);
        
        fullContent += `# ${entity.name}\n\n`;
        fullContent += `**Type:** ${entity.type}\n\n`;
        if (entity.description) fullContent += `${entity.description}\n\n`;
        
        if (claims.length > 0) {
          fullContent += `## Claims\n\n`;
          for (const claim of claims) {
            fullContent += `- ${claim.statement}`;
            if (claim.confidence !== 1) fullContent += ` (confidence: ${claim.confidence})`;
            fullContent += `\n`;
            if (claim.evidence) fullContent += `  - *Evidence:* ${claim.evidence}\n`;
          }
          fullContent += '\n';
        }
        
        if (notes.length > 0) {
          fullContent += `## Notes\n\n`;
          for (const note of notes) {
            fullContent += `${note.content}\n\n`;
          }
        }
        fullContent += '\n---\n\n';
      }
      
      downloadFile(fullContent, 'knowledge-base.md', 'text/markdown');
      logger.info('Markdown export complete');
    } catch (err) {
      logger.error('Markdown export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const entities = await repository.getAllEntities();
      const links = await repository.getAllLinks();
      
      const claims: Record<string, Claim[]> = {};
      const notes: Record<string, Note[]> = {};
      
      for (const entity of entities) {
        if (!entity.id) continue;
        claims[entity.id] = await repository.getClaimsByEntityId(entity.id);
        notes[entity.id] = await repository.getNotesByEntityId(entity.id);
      }
      
      const data = {
        exported_at: new Date().toISOString(),
        entities,
        claims,
        notes,
        links,
      };
      
      downloadFile(JSON.stringify(data, null, 2), 'knowledge-base.json', 'application/json');
      logger.info('JSON export complete');
    } catch (err) {
      logger.error('JSON export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSite = async () => {
    setIsExporting(true);
    try {
      const entities = await repository.getAllEntities();
      
      let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Base</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #1e293b; background: #f8fafc; }
    header { margin-bottom: 3rem; text-align: center; }
    h1 { font-size: 2.5rem; color: #0f172a; margin-bottom: 0.5rem; }
    .meta { color: #64748b; font-size: 0.875rem; }
    .entity { background: white; margin-bottom: 2rem; padding: 2rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
    .entity h2 { margin-top: 0; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; }
    .type { display: inline-block; background: #f1f5f9; padding: 0.2rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 1rem; }
    .claim { margin: 0.75rem 0; padding: 0.75rem; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 0 4px 4px 0; }
    .claim-meta { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
    .description { margin: 1rem 0; font-size: 1.1rem; }
    h3 { font-size: 1.25rem; color: #334155; margin-top: 1.5rem; }
    nav { position: sticky; top: 1rem; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 2rem; max-height: 300px; overflow-y: auto; }
    nav h4 { margin: 0 0 0.5rem 0; }
    nav ul { list-style: none; padding: 0; margin: 0; }
    nav li { margin-bottom: 0.25rem; }
    nav a { text-decoration: none; color: #64748b; font-size: 0.875rem; }
    nav a:hover { color: #2563eb; }
    @media (max-width: 640px) { body { padding: 1rem; } }
  </style>
</head>
<body>
  <header>
    <h1>Knowledge Base</h1>
    <div class="meta">Exported on ${new Date().toLocaleString()}</div>
  </header>

  <nav>
    <h4>Quick Navigation</h4>
    <ul>
      ${entities.map(e => `<li><a href="#${escapeHtml(e.name.replace(/[^a-z0-9]/gi, '-').toLowerCase())}">${escapeHtml(e.name)}</a></li>`).join('\n      ')}
    </ul>
  </nav>

  <main>
`;

      for (const entity of entities) {
        const entityId = entity.id!;
        const claims = await repository.getClaimsByEntityId(entityId);
        const safeId = entity.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        
        html += `\n    <section class="entity" id="${safeId}">\n`;
        html += `      <span class="type">${escapeHtml(entity.type)}</span>\n`;
        html += `      <h2>${escapeHtml(entity.name)}</h2>\n`;
        
        if (entity.description) {
          html += `\n      <div class="description">${sanitizeHtml(entity.description)}</div>\n`;
        }
        
        if (claims.length > 0) {
          html += `\n      <h3>Claims</h3>\n`;
          for (const claim of claims) {
            html += `      <div class="claim">\n`;
            html += `        <div class="statement">${escapeHtml(claim.statement)}</div>\n`;
            if (claim.confidence !== 1 || claim.source) {
              html += `        <div class="claim-meta">\n`;
              if (claim.confidence !== 1) html += `          <span>Confidence: ${Math.round(claim.confidence * 100)}%</span>\n`;
              if (claim.source) html += `          <span>Source: ${escapeHtml(claim.source)}</span>\n`;
              html += `        </div>\n`;
            }
            html += `      </div>\n`;
          }
        }
        
        html += `    </section>\n`;
      }

      html += `
  </main>
  <footer>
    <p style="text-align: center; color: #94a3b8; margin-top: 4rem; font-size: 0.875rem;">Generated by do-knowledge-studio</p>
  </footer>
</body>
</html>`;

      downloadFile(html, 'knowledge-base.html', 'text/html');
      logger.info('Site export complete');
    } catch (err) {
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

