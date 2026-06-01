import React from 'react';

type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai' | 'search' | 'library';

interface SidebarNavProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onClose?: () => void;
  onSearchClick?: () => void;
  onPreload?: (view: View) => void;
}

interface NavItem {
  view: View;
  label: string;
  experimental?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Capture',
    items: [
      { view: 'editor', label: 'Editor' },
    ],
  },
  {
    group: 'Explore',
    items: [
      { view: 'graph', label: 'Graph' },
      { view: 'mindmap', label: 'Mind Map' },
    ],
  },
  {
    group: 'Ask',
    items: [
      { view: 'search', label: 'Search' },
      { view: 'chat', label: 'Chat' },
    ],
  },
  {
    group: 'Move',
    items: [
      { view: 'export', label: 'Export' },
    ],
  },
  {
    group: 'Lab',
    items: [
      { view: 'ai', label: 'AI Harness', experimental: true },
    ],
  },
];

const SidebarNav: React.FC<SidebarNavProps> = ({ currentView, setCurrentView, onClose, onSearchClick, onPreload }) => {
  const handleNavClick = (view: View) => {
    if (view === 'search' && onSearchClick) {
      onSearchClick();
    } else {
      setCurrentView(view);
    }
    if (onClose) onClose();
  };

  return (
    <nav className="sidebar-nav" aria-label="Main Navigation">
      <div className="brand">Knowledge Studio</div>
      <div className="nav-content">
        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="nav-group">
            <div className="nav-group-label">{group.group}</div>
            <ul className="nav-links">
              {group.items.map((item) => (
                <li key={item.view}>
                  <button
                    className={`nav-button ${currentView === item.view ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.view)}
                    onMouseEnter={() => onPreload?.(item.view)}
                    onFocus={() => onPreload?.(item.view)}
                    aria-current={currentView === item.view ? 'page' : undefined}
                  >
                    {item.label}
                    {item.experimental && (
                      <span className="experimental-badge">Experimental</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};

export default SidebarNav;
