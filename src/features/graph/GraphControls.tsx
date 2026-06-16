import React, { useState } from 'react';
import { Focus, Camera, RotateCcw, Loader2, Layout, LayoutDashboard, Download, CircleDot, Sparkles, FolderOpen } from 'lucide-react';
import SyncToggle from '../../components/SyncToggle';
import { extractEntities } from '../../lib/ai/entity-extractor';
import type { EntityExtractionResult, ExtractedEntity, ExtractedRelationship } from '../../lib/ai/entity-extractor';
import { loadConfig, createProvider } from '../../lib/llm/config';
import EntityReviewDialog from '../ai/EntityReviewDialog';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MEDIA_QUERIES } from '../../lib/constants';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';
import SaveSnapshotModal from './SaveSnapshotModal';
import SnapshotBrowserModal from './SnapshotBrowserModal';
import type { GraphNode, GraphEdge } from './graph-schemas';

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
  const repository = useRepository();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSnapshotBrowser, setShowSnapshotBrowser] = useState(false);
  const isMobile = useMediaQuery(MEDIA_QUERIES.MOBILE);

  // Batch analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchResult, setBatchResult] = useState<EntityExtractionResult | null>(null);
  const [showBatchReview, setShowBatchReview] = useState(false);

  const handleOpenSnapshotBrowser = () => {
    setShowSnapshotBrowser(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op fallback
  const noopAsync = async () => {};

  const handleAnalyzeAllNotes = async () => {
    setIsAnalyzing(true);
    try {
      const allEntities = await repository.getAllEntities();
      // Filter for entities of type 'note' that have meaningful content in description
      const notesToAnalyze = allEntities.filter(e =>
        e.type === 'note' && e.description && e.description.trim().length > 20
      );

      if (notesToAnalyze.length === 0) {
        logger.info('No notes found for analysis');
        setIsAnalyzing(false);
        return;
      }

      const config = await loadConfig();
      const provider = createProvider(config);
      const providerConfig = config.providers[config.activeProvider];
      const model = providerConfig.defaultModel || 'google/gemini-2.0-flash-lite-preview-02-05:free';

      const allEntitiesMap = new Map<string, ExtractedEntity>();
      const allRelationships: ExtractedRelationship[] = [];

      // Process in batches of 3 to improve performance while respecting rate limits
      const BATCH_SIZE = 3;
      for (let i = 0; i < notesToAnalyze.length; i += BATCH_SIZE) {
        const batch = notesToAnalyze.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(note => extractEntities(note.description || '', provider, model))
        );

        results.forEach(result => {
          result.entities.forEach(e => {
            // Deduplicate by name, preferring the one with description if available
            const existing = allEntitiesMap.get(e.name);
            if (!existing || (!existing.description && e.description)) {
              allEntitiesMap.set(e.name, e);
            }
          });
          allRelationships.push(...result.relationships);
        });
      }

      setBatchResult({
        entities: Array.from(allEntitiesMap.values()),
        relationships: allRelationships
      });
      setShowBatchReview(true);
    } catch (err) {
      logger.error('Batch analysis failed', err);
    } finally {
      setIsAnalyzing(false);
    }
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
      <button
        onClick={() => void handleAnalyzeAllNotes()}
        disabled={isAnalyzing}
        title="Analyze all notes for new entities"
        aria-label="Analyze all notes for new entities"
        style={{ color: 'var(--interactive-primary)' }}
      >
        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {isAnalyzing ? 'Analyzing...' : 'Analyze All Notes'}
      </button>
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
      {!snapshotMode && <SyncToggle />}
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

      <SaveSnapshotModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        nodes={nodes}
        edges={edges}
        onSave={onSaveSnapshot ?? noopAsync}
      />

      <SnapshotBrowserModal
        isOpen={showSnapshotBrowser}
        onClose={() => setShowSnapshotBrowser(false)}
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op fallback
        onLoadSnapshot={onLoadSnapshot ?? (() => {})}
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op fallback
        onSnapshotModeChange={onSnapshotModeChange ?? (() => {})}
      />

      {showBatchReview && batchResult && (
        <EntityReviewDialog
          result={batchResult}
          onClose={() => { setShowBatchReview(false); }}
          onComplete={() => {
            setShowBatchReview(false);
            setBatchResult(null);
          }}
        />
      )}
    </>
  );
};

export default GraphControls;
