import React from 'react';
import { X } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="mobile-drawer-overlay" onClick={onClose}>
      <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
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
