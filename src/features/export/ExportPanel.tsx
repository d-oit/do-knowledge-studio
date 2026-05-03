import React, { useEffect, useState } from 'react';
import { jobCoordinator } from '../../lib/jobs';
import { logger } from '../../lib/logger';
import { repository } from '../../db/repository';

type ExportFormat = 'markdown' | 'json' | 'sqlite' | 'graph' | 'site';
type ExportScope = 'all' | 'selected' | 'neighborhood' | 'search';

interface Stats {
  entities: number;
  claims: number;
  links: number;
}

const ExportPanel: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [selectedScope, setSelectedScope] = useState<ExportScope>('all');
  const [stats, setStats] = useState<Stats>({ entities: 0, claims: 0, links: 0 });
  const [exportStatus, setExportStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [entities, claims, links] = await Promise.all([
          repository.getAllEntities(),
          repository.getAllClaims(),
          repository.getAllLinks(),
        ]);
        setStats({
          entities: entities.length,
          claims: claims.length,
          links: links.length,
        });
      } catch (err) {
        logger.error('Failed to fetch stats for export', err);
      }
    };

    fetchStats();

    jobCoordinator.registerHandler('prepare-export', async (payload) => {
      const { format } = payload as { format: string };
      logger.info(`Preparing export for format: ${format}`);
      // Simulate expensive work
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info(`Export prepared: ${format}`);
    });

    return () => {
      jobCoordinator.unregisterHandler('prepare-export');
    };
  }, []);

  const handleExport = async () => {
    setExportStatus('running');
    setError(null);
    try {
      jobCoordinator.enqueue('prepare-export', selectedFormat, {
        format: selectedFormat,
        scope: selectedScope,
      });
      // In a real app, we would listen for the specific job completion
      // For this demo, we'll simulate the wait
      await new Promise(resolve => setTimeout(resolve, 2500));
      setExportStatus('completed');
    } catch (err) {
      setExportStatus('failed');
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const formats: { id: ExportFormat; label: string; description: string }[] = [
    { id: 'markdown', label: 'Markdown', description: 'Interconnected .md files with wikilinks' },
    { id: 'json', label: 'JSON', description: 'Machine-readable knowledge graph' },
    { id: 'sqlite', label: 'SQLite Snapshot', description: 'Full offline storage backup' },
    { id: 'graph', label: 'Graph Data', description: 'D3/Sigma compatible JSON' },
    { id: 'site', label: 'Static Site', description: 'Self-hosted web exploration' },
  ];

  return (
    <div className="export-view">
      <div className="export-header">
        <h2>Export & Sync</h2>
        <p className="export-intro">
          Your local SQLite/OPFS storage is the canonical source of truth.
          Use exports to share knowledge or create portable artifacts.
        </p>
      </div>

      <section className="export-section">
        <h3>1. Select Format</h3>
        <div className="format-grid">
          {formats.map((f) => (
            <button
              key={f.id}
              className={`format-card ${selectedFormat === f.id ? 'selected' : ''}`}
              onClick={() => setSelectedFormat(f.id)}
            >
              <span className="format-label">{f.label}</span>
              <span className="format-desc">{f.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="export-section">
        <h3>2. Define Scope</h3>
        <div className="scope-selector">
          {(['all', 'selected', 'neighborhood', 'search'] as ExportScope[]).map((s) => (
            <button
              key={s}
              className={`filter-chip ${selectedScope === s ? 'active' : ''}`}
              onClick={() => setSelectedScope(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </section>

      <div className="export-footer">
        <div className="export-stats">
          <div className="stat-item">
            <span className="stat-value">{stats.entities}</span>
            <span className="stat-label">Entities</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.claims}</span>
            <span className="stat-label">Claims</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.links}</span>
            <span className="stat-label">Links</span>
          </div>
        </div>

        <div className="export-actions">
          <button
            className={`primary export-button ${exportStatus === 'running' ? 'loading' : ''}`}
            onClick={handleExport}
            disabled={exportStatus === 'running'}
          >
            {exportStatus === 'running' ? 'Preparing Artifacts...' : 'Generate Export'}
          </button>

          {exportStatus === 'completed' && (
            <div className="status-message success">
              Export complete! Artifacts available in Lab/Downloads.
            </div>
          )}
          {exportStatus === 'failed' && (
            <div className="status-message error">
              {error || 'Export failed. Check logs for details.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
