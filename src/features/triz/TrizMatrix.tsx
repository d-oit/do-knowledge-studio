import React, { useState, useCallback, useMemo } from 'react';
import { X, ArrowRight, Lightbulb, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { ENGINEERING_PARAMETERS, getContradictionPrinciples, getPrincipleByNumber } from '../../lib/triz-data';

interface TrizMatrixProps {
  onClose: () => void;
}

const TrizMatrix: React.FC<TrizMatrixProps> = ({ onClose }) => {
  const [improvingIdx, setImprovingIdx] = useState<number | null>(null);
  const [worseningIdx, setWorseningIdx] = useState<number | null>(null);
  const [selectedPrinciple, setSelectedPrinciple] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const suggestedPrinciples = useMemo(() => {
    if (improvingIdx === null || worseningIdx === null) return [];
    return getContradictionPrinciples(improvingIdx, worseningIdx);
  }, [improvingIdx, worseningIdx]);

  const principleDetails = useMemo(() => {
    return suggestedPrinciples.map(n => getPrincipleByNumber(n)).filter(Boolean);
  }, [suggestedPrinciples]);

  const handleCopy = useCallback((text: string, idx: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const handleReset = useCallback(() => {
    setImprovingIdx(null);
    setWorseningIdx(null);
    setSelectedPrinciple(null);
  }, []);

  return (
    <div className="triz-matrix" style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: '500px', maxWidth: '100vw',
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)',
      zIndex: 'var(--z-overlay)', display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lightbulb size={18} />
          <h3 style={{ margin: 0 }}>TRIZ Contradiction Matrix</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(improvingIdx !== null || worseningIdx !== null) && (
            <button type="button" onClick={handleReset} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }}>Reset</button>
          )}
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {improvingIdx === null ? (
          <div>
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Step 1: Select the Improving Parameter</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '13px' }}>
              Which parameter do you want to improve?
            </p>
            <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
              {ENGINEERING_PARAMETERS.map((param, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setImprovingIdx(idx)}
                  style={{
                    display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                    border: 'none', borderBottom: '1px solid var(--border-subtle)',
                    background: 'transparent', cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  {idx + 1}. {param}
                </button>
              ))}
            </div>
          </div>
        ) : worseningIdx === null ? (
          <div>
            <div style={{ padding: '10px', background: 'var(--entity-concept-bg)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <strong>Improving:</strong> {ENGINEERING_PARAMETERS[improvingIdx]}
            </div>
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Step 2: Select the Worsening Parameter</h4>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '13px' }}>
              Which parameter gets worse as a result?
            </p>
            <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
              {ENGINEERING_PARAMETERS.map((param, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setWorseningIdx(idx)}
                  disabled={idx === improvingIdx}
                  style={{
                    display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                    border: 'none', borderBottom: '1px solid var(--border-subtle)',
                    background: idx === improvingIdx ? 'var(--bg-base)' : 'transparent',
                    cursor: idx === improvingIdx ? 'not-allowed' : 'pointer',
                    fontSize: '13px', opacity: idx === improvingIdx ? 0.5 : 1,
                  }}
                >
                  {idx + 1}. {param}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px', background: 'var(--entity-concept-bg)', borderRadius: '8px', fontSize: '13px' }}>
              <strong>{ENGINEERING_PARAMETERS[improvingIdx]}</strong>
              <ArrowRight size={14} />
              <strong>{ENGINEERING_PARAMETERS[worseningIdx]}</strong>
            </div>

            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>
              Suggested Inventive Principles ({principleDetails.length})
            </h4>

            {principleDetails.map((principle) => principle && (
              <div key={principle.number} style={{
                border: '1px solid var(--border-default)', borderRadius: '8px',
                marginBottom: '8px', background: selectedPrinciple === principle.number ? 'var(--entity-note-bg)' : 'var(--bg-base)',
              }}>
                <button
                  type="button"
                  onClick={() => { setSelectedPrinciple(selectedPrinciple === principle.number ? null : principle.number); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: '13px',
                  }}
                >
                  {selectedPrinciple === principle.number ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontWeight: 600, color: 'var(--interactive-primary)', minWidth: '24px' }}>#{principle.number}</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{principle.name}</span>
                </button>
                {selectedPrinciple === principle.number && (
                  <div style={{ padding: '0 12px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: '8px' }}>{principle.description}</p>
                    <div style={{ marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Examples:</strong>
                      <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                        {principle.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => { handleCopy(`Principle #${principle.number}: ${principle.name}\n${principle.description}`, principle.number); }}
                      className="btn-secondary"
                      style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copiedIdx === principle.number ? <Check size={12} /> : <Copy size={12} />}
                      {copiedIdx === principle.number ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button type="button" onClick={handleReset} className="btn-secondary" style={{ width: '100%', marginTop: '8px' }}>
              Try Another Contradiction
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrizMatrix;
