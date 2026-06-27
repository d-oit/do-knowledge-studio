import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Plus, Link2, FileText, Loader2, Check, X } from 'lucide-react';
import { useSpeechRecognition } from '../../lib/speech-recognition';
import { parseVoiceInput } from '../../lib/nlp-intent-parser';
import { repository } from '../../db/repository';
import { logger } from '../../lib/logger';

interface VoiceInputProps {
  onEntityCreated?: (name: string) => void;
  onClose?: () => void;
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onEntityCreated, onClose }) => {
  const { state, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const [parsed, setParsed] = useState<ReturnType<typeof parseVoiceInput> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const handleParse = useCallback(() => {
    if (state.transcript) {
      const result = parseVoiceInput(state.transcript);
      setParsed(result);
    }
  }, [state.transcript]);

  const handleCreateEntities = useCallback(async () => {
    if (!parsed) return;
    setIsProcessing(true);
    let count = 0;

    try {
      for (const entity of parsed.entities) {
        try {
          await repository.createEntity({
            name: entity.name,
            type: entity.type,
            description: entity.description,
          });
          count++;
          onEntityCreated?.(entity.name);
        } catch (err) {
          logger.warn('Failed to create entity from voice', { name: entity.name, error: err });
        }
      }

      for (const claim of parsed.claims) {
        try {
          const entity = await repository.getEntityByName(claim.entityName);
          if (entity?.id) {
            await repository.createClaim({
              entity_id: entity.id,
              statement: claim.statement,
              confidence: claim.confidence,
            });
            count++;
          }
        } catch (err) {
          logger.warn('Failed to create claim from voice', { error: err });
        }
      }

      for (const rel of parsed.relations) {
        try {
          const source = await repository.getEntityByName(rel.source);
          const target = await repository.getEntityByName(rel.target);
          if (source?.id && target?.id) {
            await repository.createLink({
              source_id: source.id,
              target_id: target.id,
              relation: rel.relation,
            });
            count++;
          }
        } catch (err) {
          logger.warn('Failed to create link from voice', { error: err });
        }
      }

      setCreatedCount(count);
      resetTranscript();
      setParsed(null);
    } finally {
      setIsProcessing(false);
    }
  }, [parsed, onEntityCreated, resetTranscript]);

  return (
    <div className="voice-input" style={{
      border: '1px solid var(--border-default)', borderRadius: '12px',
      padding: '16px', background: 'var(--bg-surface)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mic size={16} /> Voice Input
        </h4>
        {onClose && (
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
            <X size={16} />
          </button>
        )}
      </div>

      {!state.isSupported && (
        <p style={{ color: 'var(--status-danger)', fontSize: '13px' }}>
          Speech recognition is not supported in this browser.
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={state.isListening ? stopListening : startListening}
          disabled={!state.isSupported}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 16px', borderRadius: '8px', border: 'none',
            background: state.isListening ? 'var(--status-danger)' : 'var(--interactive-primary)',
            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
          }}
        >
          {state.isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {state.isListening ? 'Stop' : 'Start Listening'}
        </button>
        {state.transcript && !parsed && (
          <button type="button" onClick={handleParse} className="btn-secondary" style={{ fontSize: '14px' }}>
            Parse
          </button>
        )}
      </div>

      {state.error && (
        <p style={{ color: 'var(--status-danger)', fontSize: '13px', marginBottom: '8px' }}>{state.error}</p>
      )}

      {(state.transcript || state.interimTranscript) && (
        <div style={{ padding: '10px', background: 'var(--bg-base)', borderRadius: '8px', marginBottom: '12px', fontSize: '14px', minHeight: '40px' }}>
          <span style={{ color: 'var(--text-primary)' }}>{state.transcript}</span>
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{state.interimTranscript}</span>
        </div>
      )}

      {parsed && (
        <div style={{ marginBottom: '12px' }}>
          <ParsedResults parsed={parsed} />
          <button
            type="button"
            onClick={() => void handleCreateEntities()}
            disabled={isProcessing}
            className="primary"
            style={{ width: '100%', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            {isProcessing ? 'Creating...' : `Create ${parsed.entities.length + parsed.claims.length + parsed.relations.length} Items`}
          </button>
        </div>
      )}

      {createdCount > 0 && (
        <div style={{ padding: '8px 12px', background: 'var(--status-success-bg)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Check size={14} color="var(--status-success)" />
          Created {createdCount} items from voice input
        </div>
      )}
    </div>
  );
};

const ParsedResults: React.FC<{ parsed: ReturnType<typeof parseVoiceInput> }> = ({ parsed }) => (
  <div style={{ fontSize: '13px' }}>
    {parsed.entities.length > 0 && (
      <div style={{ marginBottom: '8px' }}>
        <strong style={{ color: 'var(--text-muted)' }}>Entities:</strong>
        {parsed.entities.map((e, i) => (
          <span key={i} style={{ display: 'inline-block', margin: '2px 4px', padding: '2px 8px', background: 'var(--entity-concept-bg)', color: 'var(--entity-concept-text)', borderRadius: '12px', fontSize: '12px' }}>
            {e.name} <span style={{ opacity: 0.7 }}>({e.type})</span>
          </span>
        ))}
      </div>
    )}
    {parsed.claims.length > 0 && (
      <div style={{ marginBottom: '8px' }}>
        <strong style={{ color: 'var(--text-muted)' }}>Claims:</strong>
        {parsed.claims.map((c, i) => (
          <div key={i} style={{ margin: '2px 0', padding: '4px 8px', background: 'var(--entity-note-bg)', color: 'var(--entity-note-text)', borderRadius: '6px', fontSize: '12px' }}>
            <FileText size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {c.statement}
          </div>
        ))}
      </div>
    )}
    {parsed.relations.length > 0 && (
      <div>
        <strong style={{ color: 'var(--text-muted)' }}>Relations:</strong>
        {parsed.relations.map((r, i) => (
          <div key={i} style={{ margin: '2px 0', padding: '4px 8px', background: 'var(--entity-person-bg)', color: 'var(--entity-person-text)', borderRadius: '6px', fontSize: '12px' }}>
            <Link2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            {r.source} → [{r.relation}] → {r.target}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default VoiceInput;
