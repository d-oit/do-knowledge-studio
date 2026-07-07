import React, { useRef, useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useScrollLock } from '../hooks/useScrollLock';

export interface OverlayProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy?: string;
  ariaLabel?: string;
  variant?: 'center' | 'sheet-bottom' | 'sheet-left' | 'fullscreen';
  initialFocusRef?: React.RefObject<HTMLElement>;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  center: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(100% - 2rem, 640px)',
    maxHeight: 'calc(100dvh - 2rem)',
    overflowY: 'auto',
  },
  'sheet-bottom': {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '85dvh',
    overflowY: 'auto',
    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
  },
  'sheet-left': {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    width: 'min(100% - 3rem, 360px)',
    overflowY: 'auto',
  },
  fullscreen: {
    position: 'fixed',
    inset: 0,
    width: '100%',
    height: '100%',
    overflowY: 'auto',
  },
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--bg-overlay)',
  zIndex: 300,
  animation: 'overlayFadeIn 200ms ease-out',
};

const contentStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  boxShadow: 'var(--shadow-lg)',
  padding: 'var(--space-6)',
  paddingBottom: 'calc(var(--space-6) + env(safe-area-inset-bottom, 0px))',
  animation: 'overlayContentEnter 300ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const Overlay: React.FC<OverlayProps> = ({
  isOpen,
  onClose,
  labelledBy,
  ariaLabel,
  variant = 'center',
  initialFocusRef,
  closeOnBackdrop = true,
  children,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useFocusTrap(contentRef, isOpen);
  useEscapeKey(onClose, isOpen);
  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      }
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen, initialFocusRef]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      style={backdropStyle}
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && closeOnBackdrop) onClose();
      }}
      role="presentation"
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        style={{
          ...variantStyles[variant],
          ...contentStyle,
        }}
        onClick={handleContentClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Overlay;
