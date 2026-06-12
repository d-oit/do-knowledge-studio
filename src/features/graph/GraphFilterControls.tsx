import React, { useState } from 'react';
import { Focus, Download, RotateCcw, Loader2, Sparkles } from 'lucide-react';
import SyncToggle from '../../components/SyncToggle';
import { extractEntities } from '../../lib/ai/entity-extractor';
import type { EntityExtractionResult, ExtractedEntity, ExtractedRelationship } from '../../lib/ai/entity-extractor';
import { loadConfig, createProvider } from '../../lib/llm/config';
import EntityReviewDialog from '../ai/EntityReviewDialog';
import { useRepository } from '../../db/useRepository';
import { logger } from '../../lib/logger';

interface GraphFilterControlsProps {
  focusMode: boolean;
  setFocusMode: (focus: boolean) => void;
  hasSelection: boolean;
  selectedName?: string;
  onExportPNG?: () => void;
  snapshotMode?: boolean;
  onSnapshotModeChange?: (active: boolean) => void;
  isMobile: boolean;
}

const GraphFilterControls: React.FC<GraphFilterControlsProps> = ({
  focusMode,
  setFocusMode,
  hasSelection,
  selectedName,
  onExportPNG,
  snapshotMode = false,
  onSnapshotModeChange,
  isMobile,
}) => {
  const repository = useRepository();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchResult, setBatchResult] = useState<EntityExtractionResult | null>(null);
  const [showBatchReview, setShowBatchReview] = useState(false);

  const handleAnalyzeAllNotes = async () => {
    setIsAnalyzing(true);
    try {
      const allEntities = await repository.getAllEntities();
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

      const BATCH_SIZE = 3;
      for (let i = 0; i < notesToAnalyze.length; i += BATCH_SIZE) {
        const batch = notesToAnalyze.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(note => extractEntities(note.description || '', provider, model))
        );

        results.forEach(result => {
          result.entities.forEach(e => {
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

  return (
    <>
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

export default GraphFilterControls;
