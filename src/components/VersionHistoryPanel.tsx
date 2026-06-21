import React, { useState, useEffect, useCallback } from 'react';
import { History, RotateCcw, GitCompare, ChevronDown, ChevronRight } from 'lucide-react';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import type { EntityVersion } from '../../db/repository/entity-versions';

interface VersionHistoryPanelProps {
  entityId: string;
  onRestore?: (entityId: string) => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({ entityId, onRestore }) => {
  const repository = useRepository();
  const [versions, setVersions] = useState<EntityVersion[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<{
    name: { old: string; new: string } | null;
    type: { old: string; new: string } | null;
    description: { old: string | null; new: string | null } | null;
    metadata: { old: string | null; new: string | null } | null;
  } | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      const vers = await repository.getEntityVersions(entityId);
      setVersions(vers);
    } catch (err) {
      logger.error('Failed to load entity versions', err);
    }
  }, [entityId, repository]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const handleRestore = async (version: number) => {
    try {
      await repository.restoreEntityVersion(entityId, version);
      await loadVersions();
      onRestore?.(entityId);
    } catch (err) {
      logger.error('Failed to restore entity version', err);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions.length !== 2) return;
    try {
      const [v1, v2] = selectedVersions.map(Number).sort((a, b) => b - a);
      const diff = await repository.diffEntityVersions(entityId, v1, v2);
      setDiffResult(diff);
    } catch (err) {
      logger.error('Failed to diff versions', err);
    }
  };

  const handleToggleSelect = (version: string) => {
    setSelectedVersions(prev =>
      prev.includes(version)
        ? prev.filter(v => v !== version)
        : prev.length < 2 ? [...prev, version] : [prev[1], version]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="version-history-panel">
      <div className="version-history-header">
        <History size={16} />
        <span>Version History</span>
        {versions.length > 0 && (
          <span className="version-count">{versions.length} versions</span>
        )}
      </div>

      {versions.length === 0 ? (
        <p className="version-empty">No version history available. Versions are captured automatically when entities are updated.</p>
      ) : (
        <>
          {selectedVersions.length === 2 && (
            <button type="button" className="btn-secondary" onClick={() => void handleCompare()}>
              <GitCompare size={14} /> Compare Selected
            </button>
          )}

          <div className="version-list">
            {versions.map((version) => (
              <div key={version.id} className="version-item">
                <div className="version-item-header">
                  <input
                    type="checkbox"
                    checked={selectedVersions.includes(String(version.version))}
                    onChange={() => { handleToggleSelect(String(version.version)); }}
                    aria-label={`Select version ${version.version}`}
                  />
                  <button
                    className="version-expand"
                    onClick={() => { setExpandedVersion(expandedVersion === version.version ? null : version.version); }}
                    aria-expanded={expandedVersion === version.version}
                  >
                    {expandedVersion === version.version ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="version-number">v{version.version}</span>
                    <span className="version-date">{formatDate(version.created_at)}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary version-restore"
                    onClick={() => void handleRestore(version.version)}
                    aria-label={`Restore version ${version.version}`}
                  >
                    <RotateCcw size={12} /> Restore
                  </button>
                </div>

                {expandedVersion === version.version && (
                  <div className="version-details">
                    <div className="version-field">
                      <span className="version-label">Name:</span>
                      <span className="version-value">{version.name}</span>
                    </div>
                    <div className="version-field">
                      <span className="version-label">Type:</span>
                      <span className="version-value">{version.type}</span>
                    </div>
                    {version.description && (
                      <div className="version-field">
                        <span className="version-label">Description:</span>
                        <span className="version-value">{version.description.slice(0, 200)}...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {diffResult && (
            <div className="version-diff">
              <h4>Diff Results</h4>
              {diffResult.name && (
                <div className="diff-field">
                  <span className="diff-label">Name:</span>
                  <span className="diff-old">{diffResult.name.old}</span>
                  <span className="diff-arrow">→</span>
                  <span className="diff-new">{diffResult.name.new}</span>
                </div>
              )}
              {diffResult.type && (
                <div className="diff-field">
                  <span className="diff-label">Type:</span>
                  <span className="diff-old">{diffResult.type.old}</span>
                  <span className="diff-arrow">→</span>
                  <span className="diff-new">{diffResult.type.new}</span>
                </div>
              )}
              {diffResult.description && (
                <div className="diff-field">
                  <span className="diff-label">Description:</span>
                  <span className="diff-old">{(diffResult.description.old || '').slice(0, 100)}</span>
                  <span className="diff-arrow">→</span>
                  <span className="diff-new">{(diffResult.description.new || '').slice(0, 100)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default VersionHistoryPanel;
