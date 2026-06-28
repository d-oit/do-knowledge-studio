import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface ClaimMetadataPopoverProps {
  source: string;
  verificationStatus: string;
  onSave: (source: string, status: string) => void;
  onClose: () => void;
}

const VERIFICATION_OPTIONS = ['unverified', 'verified', 'disputed'] as const;

export const ClaimMetadataPopover: React.FC<ClaimMetadataPopoverProps> = ({
  source: initialSource,
  verificationStatus: initialStatus,
  onSave,
  onClose,
}) => {
  const [source, setSource] = useState(initialSource);
  const [status, setStatus] = useState(initialStatus);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sourceInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('keydown', handleEscape); };
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [onClose]);

  const handleSave = useCallback(() => {
    onSave(source.trim(), status);
  }, [source, status, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  return (
    <div ref={popoverRef} className="claim-metadata-popover" role="dialog" aria-label="Claim metadata">
      <div className="claim-metadata-header">
        <ShieldCheck size={14} />
        <span>Claim Metadata</span>
        <button type="button" className="claim-metadata-close" onClick={onClose} aria-label="Close">
          <X size={12} />
        </button>
      </div>
      <div className="claim-metadata-body">
        <label htmlFor="claim-source" className="claim-metadata-label">Source</label>
        <input
          ref={sourceInputRef}
          id="claim-source"
          type="text"
          value={source}
          onChange={e => { setSource(e.target.value); }}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Wikipedia, research paper..."
          className="claim-metadata-input"
        />
        <label htmlFor="claim-status" className="claim-metadata-label">Verification</label>
        <select
          id="claim-status"
          value={status}
          onChange={e => { setStatus(e.target.value); }}
          className="claim-metadata-select"
        >
          {VERIFICATION_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
      <div className="claim-metadata-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};
