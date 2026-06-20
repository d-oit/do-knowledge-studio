import React from 'react';
import { X } from 'lucide-react';
import Overlay from './Overlay';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, children }) => {
  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      variant="sheet-left"
      ariaLabel="Navigation"
    >
      <div className="drawer-header">
        <button className="close-button" onClick={onClose} aria-label="Close menu">
          <X size={24} />
        </button>
      </div>
      {children}
    </Overlay>
  );
};

export default MobileDrawer;
