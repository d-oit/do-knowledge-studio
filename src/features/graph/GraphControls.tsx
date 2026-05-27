import React, { useState, useRef, useEffect } from 'react';
import { Focus, Camera, Clock, X, FolderOpen, GitCompare, RotateCcw, Loader2, Layout, LayoutDashboard, Download, CircleDot } from 'lucide-react';
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
  onExportPNG?: () => void;
  snapshotMode?: boolean;
  onSnapshotModeChange?: (active: boolean) => void;
  layout?: 'circular' | 'force' | 'hierarchical';
  onLayoutChange?: (layout: 'circular' | 'force' | 'hierarchical') => void;
}

const GraphControls: React.FC<GraphControlsProps> = ({
  focusMode,
  setFocusMode,
  hasSelection,
  selectedName,
  nodes = [],
  edges = [],
  onSaveSnapshot,
  onLoadSnapshot,
  onExportPNG,
  snapshotMode = false,
  onSnapshotModeChange,
  layout = 'force',
  onLayoutChange,
}) => {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
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

  useFocusTrap(modalRef, showSaveModal);
  useEscapeKey(() => setShowSaveModal(false), showSaveModal);
  useFocusTrap(snapshotBrowserRef, showSnapshotBrowser);
  useEscapeKey(() => { setShowSnapshotBrowser(false); setDiffResult(null); }, showSnapshotBrowser);

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

  const handleSaveSnapshot = async () => {
    if (!snapshotName.trim() || !onSaveSnapshot) return;
    await onSaveSnapshot(snapshotName, nodes, edges);
    setShowSaveModal(false);
    setSnapshotName('');
    setSnapshotDesc('');
  };

  const controls = (
    <div className={isMobile ? "viz-controls-mobile" : "viz-controls"}>
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={focusMode ? 'active' : ''}
        disabled={!hasSelection}
        aria-pressed={focusMode}
        aria-label={focusMode ? 'Show all nodes' : 'Focus on neighborhood'}
        title={!hasSelection ? "Select a node first" : "Toggle Neighborhood Focus"}
      >
        <Focus size={16} /> {focusMode ? 'Show All' : 'Focus Neighborhood'}
      </button>
      {onExportPNG && (
        <button
          onClick={onExportPNG}
          aria-label="Export graph as PNG"
          title="Export graph as PNG image"
        >
          <Download size={16} /> Export PNG
        </button>
      )}
      {onSaveSnapshot && (
        <button
          onClick={() => setShowSaveModal(true)}
          aria-label="Save graph snapshot"
          title="Save Graph Snapshot"
        >
          <Camera size={16} /> Save Snapshot
        </button>
      )}
      {onLoadSnapshot && (
        <button
          onClick={() => void handleOpenSnapshotBrowser()}
          aria-label="Load or diff saved snapshots"
          title="Load or diff saved snapshots"
        >
          <FolderOpen size={16} /> Load Snapshot
        </button>
      )}
      {snapshotMode && onSnapshotModeChange && (
        <button
          onClick={() => onSnapshotModeChange(false)}
          className="active"
          aria-label="Return to live graph"
          title="Return to live graph"
        >
          <RotateCcw size={16} /> Exit Snapshot
        </button>
      )}
      {hasSelection && !isMobile && (
        <div className="selection-info">
          Selected: <strong>{selectedName}</strong>
        </div>
      )}
      {onLayoutChange && (
        <div className="layout-toggle" style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button
            onClick={() => onLayoutChange('circular')}
            className={layout === 'circular' ? 'active' : ''}
            aria-pressed={layout === 'circular'}
            aria-label="Circular layout"
            title="Circular layout"
            style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
          >
            <CircleDot size={14} /> Circular
          </button>
          <button
            onClick={() => onLayoutChange('force')}
            className={layout === 'force' ? 'active' : ''}
            aria-pressed={layout === 'force'}
            aria-label="Force-directed layout"
            title="Force-directed layout"
            style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
          >
            <LayoutDashboard size={14} /> Force
          </button>
          <button
            onClick={() => onLayoutChange('hierarchical')}
            className={layout === 'hierarchical' ? 'active' : ''}
            aria-pressed={layout === 'hierarchical'}
            aria-label="Hierarchical layout"
            title="Hierarchical layout"
            style={{ padding: '6px 10px', minHeight: '36px', fontSize: '12px' }}
          >
            <Layout size={14} /> Hierarchical
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {controls}

      {showSaveModal && (
        <button type="button" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setShowSaveModal(false); }}>
          <div
            ref={modalRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="inspector-header" style={{ marginBottom: 'var(--space-4)', padding: 0, background: 'transparent', border: 0 }}>
              <h3 id="modal-title"><Camera size={18} /> Save Graph Snapshot</h3>
              <button className="close-button" onClick={() => setShowSaveModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <p className="modal-meta" style={{ marginBottom: 'var(--space-4)', fontSize: '13px', color: 'var(--text-muted)' }}>
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
                style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-base)', border: '1px solid var(--border-default)' }}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => void handleSaveSnapshot()}
                disabled={!snapshotName.trim()}
                className="btn-primary"
              >
                <Camera size={14} /> Save Snapshot
              </button>
            </div>
          </div>
        </button>
      )}

      {showSnapshotBrowser && (
        <button type="button" className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowSnapshotBrowser(false); setDiffResult(null); } }} onKeyDown={(e) => { if (e.key === 'Escape') { setShowSnapshotBrowser(false); setDiffResult(null); } }}>
          <div
            ref={snapshotBrowserRef}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="snapshot-browser-title"
            style={{ maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}
          >
            <div className="inspector-header" style={{ marginBottom: 'var(--space-4)', padding: 0, background: 'transparent', border: 0 }}>
              <h3 id="snapshot-browser-title"><FolderOpen size={18} /> Graph Snapshots</h3>
              <button className="close-button" onClick={() => { setShowSnapshotBrowser(false); setDiffResult(null); }} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            {isLoadingSnapshots ? (
              <p style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>Loading snapshots...</p>
            ) : snapshots.length === 0 ? (
              <p style={{ textAlign: 'center', padding: 'var(--space-4)', color: 'var(--text-muted)' }}>No snapshots saved yet. Use Save Snapshot to create one.</p>
            ) : (
              <>
                <p style={{ marginBottom: 'var(--space-3)', fontSize: '13px', color: 'var(--text-muted)' }}>
                  Click a snapshot to load it. Select two and click Compare to see differences.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 'var(--space-3)' }}>
                  {snapshots.map(snap => {
                    if (!snap.id) return null;
                    const isSelected = selectedForDiff.includes(snap.id);
                    return (
                      <button
                        key={snap.id}
                        type="button"
                        onClick={() => { handleToggleDiffSelect(snap.id); }}
                        onDoubleClick={() => void handleLoadSnapshot(snap.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px',
                          border: isSelected ? '2px solid var(--interactive-primary)' : '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-base)',
                          background: isSelected ? 'var(--interactive-primary-subtle)' : 'var(--bg-surface)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          width: '100%',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          color: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '28px', fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {isSelected ? (selectedForDiff.indexOf(snap.id) + 1) : ''}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px' }}>{snap.name}</div>
                          {snap.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{snap.description}</div>}
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {new Date(snap.created_at).toLocaleString()}
                          </div>
                        </div>
                        {loadingSnapshotId === snap.id && <Loader2 size={14} className="animate-spin" />}
                      </button>
                    );
                  })}
                </div>

                <div className="modal-actions" style={{ marginBottom: 'var(--space-3)' }}>
                  <button
                    onClick={() => void handleDiff()}
                    disabled={selectedForDiff.length !== 2}
                    className="btn-primary"
                  >
                    <GitCompare size={14} /> Compare Selected
                  </button>
                </div>

                {diffResult && (
                  <div style={{
                    padding: 'var(--space-3)',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-base)',
                    border: '1px solid var(--border-default)',
                  }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px' }}>Diff Results</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
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
        </button>
      )}
    </>
  );
};

export default GraphControls;
