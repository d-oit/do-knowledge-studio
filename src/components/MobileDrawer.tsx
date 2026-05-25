import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, children }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(drawerRef, isOpen);
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="mobile-drawer-overlay"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
      role="button"
      tabIndex={0}
      aria-label="Close navigation drawer"
    >
      <div
        ref={drawerRef}
        className="mobile-drawer-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Drawer"
      >
        <div className="drawer-header">
          <button className="close-button" onClick={onClose} aria-label="Close menu">
            <X size={24} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export default MobileDrawer;
