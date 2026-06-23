import React, { useState, useEffect, useCallback } from 'react';
import { History, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import type { EntityVersion } from '../../db/repository/entity-versions';

interface DiffField {
  label: string;
  old: string | null;
  new: string | null;
}

interface VersionHistoryPanelProps {
  entityId: string;
  onRestore?: () => void;
}

/**
 * Browser for the per-entity revision history.
 *
 * Lists every version recorded in `entity_versions` (ordered newest
 * first). Expanding a version reveals the stored field values plus
 * a diff against the previous version, computed on demand via
 * {@link diffEntityVersions}. "Restore" rewrites the entity's
 * current fields from the chosen version and emits `onRestore` so
 * the parent can refresh its state.
 */
const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ entityId, onRestore }) => {
  const repository = useRepository();
  const [versions, setVersions] = useState<EntityVersion[]>([]);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [diffData, setDiffData] = useState<Record<number, DiffField[]>>({});
  const [restoring, setRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await repository.getEntityVersions(entityId);
      setVersions(result);
    } catch (err) {
      logger.error('Failed to load entity versions', { error: err });
    } finally {
      setIsLoading(false);
    }
  }, [entityId, repository]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch, setState inside async callback
    void loadVersions();
  }, [loadVersions]);

  const loadDiff = useCallback(async (version: number) => {
    if (version <= 1) return;
    try {
      const result = await repository.diffEntityVersions(entityId, version - 1, version);
      const fields: DiffField[] = [];
      if (result.name) fields.push({ label: 'Name', old: result.name.old, new: result.name.new });
      if (result.type) fields.push({ label: 'Type', old: result.type.old, new: result.type.new });
      if (result.description) fields.push({ label: 'Content', old: result.description.old, new: result.description.new });
      if (result.metadata) fields.push({ label: 'Metadata', old: result.metadata.old, new: result.metadata.new });
      setDiffData(prev => ({ ...prev, [version]: fields }));
    } catch (err) {
      logger.error('Failed to load version diff', { error: err });
    }
  }, [entityId, repository]);

  const handleToggleExpand = useCallback(async (version: number) => {
    if (expandedVersion === version) {
      setExpandedVersion(null);
    } else {
      setExpandedVersion(version);
      if (!diffData[version]) {
        await loadDiff(version);
      }
    }
  }, [expandedVersion, diffData, loadDiff]);

  const handleRestore = useCallback(async (version: number) => {
    setRestoring(true);
    try {
      await repository.restoreEntityVersion(entityId, version);
      await loadVersions();
      onRestore?.();
    } catch (err) {
      logger.error('Failed to restore version', { error: err });
    } finally {
      setRestoring(false);
    }
  }, [entityId, repository, loadVersions, onRestore]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <section className="version-history-panel" aria-label="Loading version history">
        <div className="version-history-header">
          <History size={14} aria-hidden="true" />
          Version History
        </div>
        <p className="version-empty">Loading versions...</p>
      </section>
    );
  }

  if (versions.length === 0) {
    return (
      <section className="version-history-panel" aria-label="No version history">
        <div className="version-history-header">
          <History size={14} aria-hidden="true" />
          Version History
        </div>
        <p className="version-empty">No versions yet. Save changes to create versions.</p>
      </section>
    );
  }

  return (
    <section className="version-history-panel" aria-label="Version history">
      <div className="version-history-header">
        <History size={14} aria-hidden="true" />
        Version History
        <span className="version-count">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="version-list">
        {versions.map((v) => {
          const isExpanded = expandedVersion === v.version;
          const diff = diffData[v.version];
          return (
            <div key={v.version} className="version-item">
              <div className="version-item-header">
                <button
                  type="button"
                  className="version-expand"
                  onClick={() => void handleToggleExpand(v.version)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="version-number">v{v.version}</span>
                  <span className="version-date">{formatDate(v.created_at)}</span>
                </button>
                <button
                  type="button"
                  className="version-restore"
                  onClick={() => void handleRestore(v.version)}
                  disabled={restoring}
                  title={`Restore to version ${v.version}`}
                  aria-label={`Restore to version ${v.version}`}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Restore
                </button>
              </div>
              {isExpanded && (
                <div className="version-details">
                  <div className="version-field">
                    <span className="version-label">Name</span>
                    <span className="version-value">{v.name}</span>
                  </div>
                  <div className="version-field">
                    <span className="version-label">Type</span>
                    <span className="version-value">{v.type}</span>
                  </div>
                  {v.description && (
                    <div className="version-field">
                      <span className="version-label">Content</span>
                      <span className="version-value">{v.description.substring(0, 200)}{v.description.length > 200 ? '...' : ''}</span>
                    </div>
                  )}
                  {diff && diff.length > 0 && (
                    <div className="version-diff">
                      <h4>Changes from v{v.version - 1}</h4>
                      {diff.map((d) => (
                        <div key={d.label} className="diff-field">
                          <span className="diff-label">{d.label}</span>
                          <span className="diff-old">{d.old}</span>
                          <span className="diff-arrow">→</span>
                          <span className="diff-new">{d.new}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {v.version === 1 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Initial version — no previous version to compare.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default VersionHistoryPanel;
