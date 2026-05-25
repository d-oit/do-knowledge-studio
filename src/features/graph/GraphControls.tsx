import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Focus, Camera, Clock, X, FolderOpen, GitCompare, RotateCcw, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA_QUERIES } from '../../lib/constants';
import type { GraphSnapshot } from '../../lib/validation';
import { repository, type GraphSnapshotDiff } from '../../db/repository';
import { logger } from '../../lib/logger';

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface GraphControlsProps {
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  hasSelection: boolean;
  selectedName?: string;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  onSaveSnapshot?: (name: string, nodes: GraphNode[], edges: GraphEdge[]) => Promise<void>;
  onLoadSnapshot?: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  snapshotMode?: boolean;
  onSnapshotModeChange?: (active: boolean) => void;
}

// Module-level style constants to avoid inline object recreation on every render
const MODAL_HEADER_STYLE: React.CSSProperties = {
  marginBottom: 'var(--space-4)',
  padding: 0,
  background: 'transparent',
  border: 0,
};

const MODAL_META_STYLE: React.CSSProperties = {
  marginBottom: 'var(--space-4)',
  fontSize: '13px',
  color: 'var(--text-muted)',
};

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  padding: 'var(--space-2)',
  borderRadius: 'var(--radius-base)',
  border: '1px solid var(--border-default)',
};

const BROWSER_MODAL_STYLE: React.CSSProperties = {
  maxWidth: '600px',
  maxHeight: '80vh',
  overflowY: 'auto',
};

const CENTERED_TEXT_STYLE: React.CSSProperties = {
  textAlign: 'center',
  padding: 'var(--space-4)',
  color: 'var(--text-muted)',
};

const HINT_TEXT_STYLE: React.CSSProperties = {
  marginBottom: 'var(--space-3)',
  fontSize: '13px',
  color: 'var(--text-muted)',
};

const DIFF_CONTAINER_STYLE: React.CSSProperties = {
  padding: 'var(--space-3)',
  background: 'var(--bg-surface)',
  borderRadius: 'var(--radius-base)',
  border: '1px solid var(--border-default)',
};

const DIFF_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  fontSize: '13px',
};

const COMPARE_BUTTONS_STYLE: React.CSSProperties = {
  marginBottom: 'var(--space-3)',
};

const SNAPSHOT_SCROLL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  marginBottom: 'var(--space-3)',
  overflowY: 'auto',
  maxHeight: '400px',
};

const GraphControls: React.FC<GraphControlsProps> = ({
  focusMode,
  setFocusMode,
  hasSelection,
  selectedName,
  nodes = [],
  edges = [],
  onSaveSnapshot,
  onLoadSnapshot,
  snapshotMode = false,
  onSnapshotModeChange,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [showMoreControls, setShowMoreControls] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery(MEDIA_QUERIES.MOBILE);

  // Snapshot browser state
  const [showSnapshotBrowser, setShowSnapshotBrowser] = useState(false);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<GraphSnapshotDiff | null>(null);
  const [loadingSnapshotId, setLoadingSnapshotId] = useState<string | null>(null);

  const snapshotNameRef = useRef<HTMLInputElement>(null);
  const snapshotBrowserRef = useRef<HTMLDivElement>(null);
  const snapshotScrollRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, showSaveModal);
  useEscapeKey(() => setShowSaveModal(false), showSaveModal);
  useFocusTrap(snapshotBrowserRef, showSnapshotBrowser);
  useEscapeKey(() => { setShowSnapshotBrowser(false); setDiffResult(null); }, showSnapshotBrowser);

  // Virtualize snapshot list for large datasets (#138)
  const snapshotVirtualizer = useVirtualizer({
    count: snapshots.length,
    getScrollElement: useCallback(() => snapshotScrollRef.current, []),
    estimateSize: useCallback(() => 100, []),
    overscan: 3,
  });

  useEffect(() => {
    if (showSaveModal && snapshotNameRef.current) {
      snapshotNameRef.current.focus();
    }
  }, [showSaveModal]);

  const fetchSnapshots = async () => {
    setIsLoadingSnapshots(true);
    try {
      const list = await repository.listSnapshots();
      setSnapshots(list);
    } catch (err) {
      logger.error('Failed to load snapshots', err);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  const handleOpenSnapshotBrowser = async () => {
    setShowSnapshotBrowser(true);
    setSelectedForDiff([]);
    setDiffResult(null);
    await fetchSnapshots();
  };

  const handleLoadSnapshot = async (snapshotId: string) => {
    setLoadingSnapshotId(snapshotId);
    try {
      const snap = await repository.getSnapshot(snapshotId);
      if (!snap) return;
      const loadedNodes = JSON.parse(snap.nodes_json) as GraphNode[];
      const loadedEdges = JSON.parse(snap.edges_json) as GraphEdge[];
      onLoadSnapshot?.(loadedNodes, loadedEdges);
      onSnapshotModeChange?.(true);
      setShowSnapshotBrowser(false);
      logger.info(`Loaded snapshot: ${snap.name}`);
    } catch (err) {
      logger.error('Failed to load snapshot', err);
    } finally {
      setLoadingSnapshotId(null);
    }
  };

  const handleToggleDiffSelect = (id: string) => {
    setSelectedForDiff(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleDiff = async () => {
    if (selectedForDiff.length !== 2) return;
    try {
      const result = await repository.diffSnapshots(selectedForDiff[0], selectedForDiff[1]);
      setDiffResult(result);
    } catch (err) {
      logger.error('Failed to diff snapshots', err);
    }
  };

  const handleSaveSnapshot = () => {
    void (async () => {
    if (!snapshotName.trim() || !onSaveSnapshot) return;
    await onSaveSnapshot(snapshotName, nodes, edges);
    setShowSaveModal(false);
    setSnapshotName('');
    setSnapshotDesc('');
    })();
  };

  const controls = (
    <div className={isMobile ? "viz-controls-mobile" : "viz-controls"}>
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={focusMode ? 'active' : ''}
        disabled={!hasSelection}
        aria-pressed={focusMode}
        title={!hasSelection ? "Select a node first" : "Toggle Neighborhood Focus"}
      >
        <Focus size={16} /> {focusMode ? 'Show All' : 'Focus Neighborhood'}
      </button>
      {onSaveSnapshot && (
        <button
          onClick={() => setShowSaveModal(true)}
          title="Save Graph Snapshot"
        >
          <Camera size={16} /> Save Snapshot
        </button>
      )}
      {snapshotMode && onSnapshotModeChange && (
        <button
          onClick={() => onSnapshotModeChange(false)}
          className="active"
          title="Return to live graph"
        >
          <RotateCcw size={16} /> Exit Snapshot
        </button>
      )}
      <button
        onClick={() => setShowMoreControls(!showMoreControls)}
        className="advanced-toggle"
        aria-expanded={showMoreControls}
        title="More graph controls"
      >
        {showMoreControls ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        More
      </button>
      {showMoreControls && onLoadSnapshot && (
        <button
          onClick={handleOpenSnapshotBrowser}
          title="Load or diff saved snapshots"
        >
          <FolderOpen size={16} /> Load Snapshot
        </button>
      )}
      {hasSelection && !isMobile && (
        <div className="selection-info">
          Selected: <strong>{selectedName}</strong>
        </div>
      )}
    </div>
  );

  return (
    <>
      {controls}

      {showSaveModal && (
        <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div
            ref={modalRef}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="inspector-header" style={MODAL_HEADER_STYLE}>
              <h3 id="modal-title"><Camera size={18} /> Save Graph Snapshot</h3>
              <button className="close-button" onClick={() => setShowSaveModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <p className="modal-meta" style={MODAL_META_STYLE}>
              <Clock size={14} /> {new Date().toLocaleString()} | {nodes.length} nodes, {edges.length} edges
            </p>

            <div className="form-group">
              <label htmlFor="snapshot-name">Snapshot Name *</label>
              <input
                id="snapshot-name"
                ref={snapshotNameRef}
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Before restructuring"
              />
            </div>
            <div className="form-group">
              <label htmlFor="snapshot-desc">Description</label>
              <textarea
                id="snapshot-desc"
                value={snapshotDesc}
                onChange={(e) => setSnapshotDesc(e.target.value)}
                placeholder="Optional notes about this snapshot..."
                rows={2}
                style={TEXTAREA_STYLE}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSaveSnapshot}
                disabled={!snapshotName.trim()}
                className="btn-primary"
              >
                <Camera size={14} /> Save Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {showSnapshotBrowser && (
        <div className="modal-overlay" onClick={() => { setShowSnapshotBrowser(false); setDiffResult(null); }}>
          <div
            ref={snapshotBrowserRef}
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="snapshot-browser-title"
            style={BROWSER_MODAL_STYLE}>
            <div className="inspector-header" style={MODAL_HEADER_STYLE}>
              <h3 id="snapshot-browser-title"><FolderOpen size={18} /> Graph Snapshots</h3>
              <button className="close-button" onClick={() => { setShowSnapshotBrowser(false); setDiffResult(null); }} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            {isLoadingSnapshots ? (
              <p style={CENTERED_TEXT_STYLE}>Loading snapshots...</p>
            ) : snapshots.length === 0 ? (
              <p style={CENTERED_TEXT_STYLE}>No snapshots saved yet. Use Save Snapshot to create one.</p>
            ) : (
              <>
                <p style={HINT_TEXT_STYLE}>
                  Click a snapshot to load it. Select two and click Compare to see differences.
                </p>
                <div ref={snapshotScrollRef} style={SNAPSHOT_SCROLL_STYLE}>
                  <div style={{ height: `${snapshotVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
                    {snapshotVirtualizer.getVirtualItems().map(virtualItem => {
                      const snap = snapshots[virtualItem.index];
                      const isSelected = selectedForDiff.includes(snap.id!);
                      return (
                        <div
                          key={snap.id}
                          data-index={virtualItem.index}
                          ref={snapshotVirtualizer.measureElement}
                          onClick={() => handleToggleDiffSelect(snap.id!)}
                          onDoubleClick={() => handleLoadSnapshot(snap.id!)}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            border: isSelected ? '2px solid var(--interactive-primary)' : '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-base)',
                            background: isSelected ? 'var(--interactive-primary-subtle)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '28px', fontWeight: isSelected ? 'bold' : 'normal' }}>
                            {isSelected ? (selectedForDiff.indexOf(snap.id!) + 1) : ''}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{snap.name}</div>
                            {snap.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{snap.description}</div>}
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                              {new Date(snap.created_at).toLocaleString()}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleLoadSnapshot(snap.id!); }}
                            className="btn-secondary"
                            disabled={loadingSnapshotId !== null}
                            style={{ padding: '4px 12px', fontSize: '12px', minWidth: '60px' }}
                            title="Load this snapshot"
                          >
                            {loadingSnapshotId === snap.id ? <Loader2 size={14} className="animate-spin" /> : 'Load'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="modal-actions" style={COMPARE_BUTTONS_STYLE}>
                  <button
                    onClick={handleDiff}
                    disabled={selectedForDiff.length !== 2}
                    className="btn-primary"
                  >
                    <GitCompare size={14} /> Compare Selected
                  </button>
                </div>

                {diffResult && (
                  <div style={DIFF_CONTAINER_STYLE}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Diff Results</h4>
                    <div style={DIFF_GRID_STYLE}>
                      <div>
                        <div style={{ color: 'var(--status-success)', fontWeight: 600, marginBottom: '4px' }}>
                          + Added Nodes ({diffResult.added_nodes.length})
                        </div>
                        {diffResult.added_nodes.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          diffResult.added_nodes.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                        )}
                      </div>
                      <div>
                        <div style={{ color: 'var(--status-danger)', fontWeight: 600, marginBottom: '4px' }}>
                          - Removed Nodes ({diffResult.removed_nodes.length})
                        </div>
                        {diffResult.removed_nodes.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          diffResult.removed_nodes.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                        )}
                      </div>
                      <div>
                        <div style={{ color: 'var(--status-success)', fontWeight: 600, marginBottom: '4px' }}>
                          + Added Edges ({diffResult.added_edges.length})
                        </div>
                        {diffResult.added_edges.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          diffResult.added_edges.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                        )}
                      </div>
                      <div>
                        <div style={{ color: 'var(--status-danger)', fontWeight: 600, marginBottom: '4px' }}>
                          - Removed Edges ({diffResult.removed_edges.length})
                        </div>
                        {diffResult.removed_edges.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>None</span>
                        ) : (
                          diffResult.removed_edges.map(id => <div key={id} style={{ marginLeft: '8px' }}>{id}</div>)
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default GraphControls;
