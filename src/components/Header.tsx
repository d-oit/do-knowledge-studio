import React from 'react';
import { Menu, Search } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  onSearchClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onSearchClick }) => {
  return (
    <header className="mobile-header">
      <button className="icon-button" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={24} />
      </button>
      <div className="mobile-brand">Knowledge Studio</div>
      <button className="icon-button" onClick={onSearchClick} aria-label="Open search">
        <Search size={24} />
      </button>
    </header>
  );
};

export default Header;
