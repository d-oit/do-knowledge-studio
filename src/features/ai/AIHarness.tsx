import React, { useState } from 'react';
import { aiService, ExtractedKnowledge } from '../../lib/ai';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';
import { Sparkles, Save, Loader2 } from 'lucide-react';

const AIHarness: React.FC = () => {
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedKnowledge | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExtract = async () => {
    if (!text.trim()) return;
    setIsExtracting(true);
    setStatus(null);
    try {
      const result = await aiService.extractKnowledge(text);
      setExtracted(result);
    } catch (err) {
      logger.error('Extraction failed', err);
      setStatus({ type: 'error', message: 'Failed to extract knowledge. Check API key.' });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extracted) return;
    setIsSaving(true);
    try {
      const nameToId = new Map<string, string>();

      // Create Entities
      for (const entity of extracted.entities) {
        const created = await repository.createEntity(entity);
        nameToId.set(entity.name, created.id!);
      }

      // Create Links
      for (const link of extracted.links) {
        const sourceId = nameToId.get(link.source_name);
        const targetId = nameToId.get(link.target_name);

        if (sourceId && targetId) {
          await repository.createLink({
            source_id: sourceId,
            target_id: targetId,
            relation: link.relation,
            metadata: {},
          });
        }
      }

      setStatus({
        type: 'success',
        message: `Saved ${extracted.entities.length} entities and ${extracted.links.length} links!`,
      });
      setExtracted(null);
      setText('');
    } catch (err) {
      logger.error('Failed to save extracted knowledge', err);
      setStatus({ type: 'error', message: 'Failed to save to database.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ai-harness-view">
      <div className="view-header">
        <h2>AI Knowledge Extractor</h2>
        <p>Paste text to auto-populate your knowledge graph.</p>
      </div>

      <div className="harness-layout">
        <div className="input-section">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your research notes, articles, or transcripts here..."
            rows={10}
          />
          <button
            className="primary extract-btn"
            onClick={handleExtract}
            disabled={isExtracting || !text.trim()}
          >
            {isExtracting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Extracting...
              </>
            ) : (
              <>
                <Sparkles size={18} /> Extract Knowledge
              </>
            )}
          </button>
        </div>

        {status && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}

        {extracted && (
          <div className="preview-section">
            <h3>Extraction Preview</h3>
            <div className="preview-lists">
              <div className="preview-group">
                <h4>Entities ({extracted.entities.length})</h4>
                <ul>
                  {extracted.entities.map((e, i) => (
                    <li key={i}>
                      <strong>{e.name}</strong> ({e.type})
                      <p>{e.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="preview-group">
                <h4>Relationships ({extracted.links.length})</h4>
                <ul>
                  {extracted.links.map((l, i) => (
                    <li key={i}>
                      {l.source_name} <em>{l.relation}</em> {l.target_name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              className="success save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save size={18} /> Save to Graph
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIHarness;
