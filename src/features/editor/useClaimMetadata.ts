import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

export interface ClaimMeta {
  source: string;
  status: string;
}

export function useClaimMetadata() {
  const [claimMetadata, setClaimMetadata] = useState<Map<string, ClaimMeta>>(new Map());
  const [showClaimPopover, setShowClaimPopover] = useState(false);
  const [currentClaimStatement, setCurrentClaimStatement] = useState('');

  const handleToggleClaim = useCallback((editor: Editor | null) => {
    if (!editor) return;
    const { state } = editor;
    const { from, to } = state.selection;
    const selectedText = state.doc.textBetween(from, to, ' ').trim();

    if (editor.isActive('claim')) {
      editor.chain().focus().unsetClaim().run();
    } else {
      editor.chain().focus().setClaim().run();
      if (selectedText) {
        setCurrentClaimStatement(selectedText);
        const existing = claimMetadata.get(selectedText);
        if (!existing) {
          setShowClaimPopover(true);
        }
      }
    }
  }, [claimMetadata]);

  const handleClaimMetadataSave = useCallback((source: string, status: string) => {
    setClaimMetadata(prev => {
      const next = new Map(prev);
      next.set(currentClaimStatement, { source, status });
      return next;
    });
    setShowClaimPopover(false);
    setCurrentClaimStatement('');
  }, [currentClaimStatement]);

  const closeClaimPopover = useCallback(() => {
    setShowClaimPopover(false);
    setCurrentClaimStatement('');
  }, []);

  const getClaimMeta = useCallback((statement: string): ClaimMeta | undefined => {
    return claimMetadata.get(statement);
  }, [claimMetadata]);

  return {
    claimMetadata,
    showClaimPopover,
    currentClaimStatement,
    handleToggleClaim,
    handleClaimMetadataSave,
    closeClaimPopover,
    getClaimMeta,
  };
}
