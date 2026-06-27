import React, { useState, useEffect, useCallback } from 'react';
import { Link2, AlertTriangle, Sparkles, X, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { runSynthesis, type SynthesisSuggestion } from '../../lib/synthesis-agent';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';

const SynthesisInbox: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [suggestions, setSuggestions] = useState<SynthesisSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const handleRunSynthesis = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await runSynthesis();
      setSuggestions(results);
    } catch (err) {
      logger.error('Synthesis failed', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApplyConnection = useCallback(async (suggestion: SynthesisSuggestion) => {
    try {
      const sourceName = suggestion.sourceEntities[0];
      const targetName = suggestion.targetEntities?.[0];
      if (!sourceName || !targetName) return;

      const source = await repository.getEntityByName(sourceName);
      const target = await repository.getEntityByName(targetName);
      if (!source?.id || !target?.id) return;

      await repository.createLink({
        source_id: source.id,
        target_id: target.id,
        relation: 'suggested',
      });

      setAppliedIds(prev => new Set(prev).add(suggestion.id));
    } catch (err) {
      logger.error('Failed to apply connection', err);
    }
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        const results = await runSynthesis();
        if (!cancelled) setSuggestions(results);
      } catch (err) {
        logger.error('Synthesis failed', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const connections = suggestions.filter(s => s.type === 'connection');
  const contradictions = suggestions.filter(s => s.type === 'contradiction');

  return (
    <div className="synthesis-inbox" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '100vw',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
      zIndex: 'var(--z-overlay)', display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} />
          <h3 style={{ margin: 0 }}>Synthesis Inbox</h3>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 8px' }} />
            Analyzing knowledge base...
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            <Sparkles size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
            <p>No suggestions found. Your knowledge base looks well-connected!</p>
            <button type="button" onClick={() => void handleRunSynthesis()} className="btn-secondary" style={{ marginTop: '12px' }}>
              Re-analyze
            </button>
          </div>
        ) : (
          <>
            {connections.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <Link2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Suggested Connections ({connections.length})
                </h4>
                {connections.map(s => (
                  <SynthesisCard
                    key={s.id}
                    suggestion={s}
                    expanded={expandedId === s.id}
                    applied={appliedIds.has(s.id)}
                    onToggle={() => { setExpandedId(expandedId === s.id ? null : s.id); }}
                    onApply={() => { void handleApplyConnection(s); }}
                    onDismiss={() => { handleDismiss(s.id); }}
                  />
                ))}
              </div>
            )}

            {contradictions.length > 0 && (
              <div>
                <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Potential Contradictions ({contradictions.length})
                </h4>
                {contradictions.map(s => (
                  <SynthesisCard
                    key={s.id}
                    suggestion={s}
                    expanded={expandedId === s.id}
                    applied={appliedIds.has(s.id)}
                    onToggle={() => { setExpandedId(expandedId === s.id ? null : s.id); }}
                    onApply={() => { void handleApplyConnection(s); }}
                    onDismiss={() => { handleDismiss(s.id); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SynthesisCard: React.FC<{
  suggestion: SynthesisSuggestion;
  expanded: boolean;
  applied: boolean;
  onToggle: () => void;
  onApply: () => void;
  onDismiss: () => void;
}> = ({ suggestion, expanded, applied, onToggle, onApply, onDismiss }) => (
  <div style={{
    border: '1px solid var(--border-default)', borderRadius: '8px',
    marginBottom: '8px', background: applied ? 'var(--status-success-bg)' : 'var(--bg-base)',
  }}>
    <button type="button" onClick={onToggle} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
      textAlign: 'left', fontSize: '13px', color: 'var(--text-primary)',
    }}>
      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <span style={{ flex: 1, fontWeight: 500 }}>{suggestion.title}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
        {Math.round(suggestion.confidence * 100)}%
      </span>
    </button>
    {expanded && (
      <div style={{ padding: '0 12px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: '8px' }}>{suggestion.description}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!applied && suggestion.type === 'connection' && (
            <button type="button" onClick={onApply} className="primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Apply Link
            </button>
          )}
          <button type="button" onClick={onDismiss} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Dismiss
          </button>
        </div>
      </div>
    )}
  </div>
);

export default SynthesisInbox;
