import React, { useRef, useEffect, useCallback } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useScrollLock } from '../hooks/useScrollLock';

export interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Accessible label for the dialog */
  'aria-label'?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Accessible overlay primitive with focus trap, Escape-to-close, and scroll lock.
 * Implements WAI-ARIA dialog pattern.
 */
export const Overlay: React.FC<OverlayProps> = ({
  isOpen,
  onClose,
  children,
  'aria-label': ariaLabel,
  className,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useFocusTrap(overlayRef, isOpen);
  useScrollLock(isOpen);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className={`overlay-backdrop ${className ?? ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-overlay)',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close overlay"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          cursor: 'default',
        }}
      />
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 'var(--space-6)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Overlay;
