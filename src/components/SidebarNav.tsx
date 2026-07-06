import React from 'react';
import {
  FileText,
  Library,
  GitBranch,
  BrainCircuit,
  Search,
  MessageSquare,
  Download,
  FlaskConical,
  Grid3X3,
  type LucideIcon,
} from 'lucide-react';

type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai' | 'search' | 'library' | 'triz';

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
  icon?: LucideIcon;
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
      { view: 'editor', label: 'Editor', icon: FileText },
    ],
  },
  {
    group: 'Explore',
    items: [
      { view: 'library', label: 'Library', icon: Library },
      { view: 'graph', label: 'Graph', icon: GitBranch },
      { view: 'mindmap', label: 'Mind Map', icon: BrainCircuit },
    ],
  },
  {
    group: 'Ask',
    items: [
      { view: 'search', label: 'Search', icon: Search },
      { view: 'chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    group: 'Move',
    items: [
      { view: 'export', label: 'Export', icon: Download },
    ],
  },
  {
    group: 'Lab',
    items: [
      { view: 'ai', label: 'AI Harness', icon: FlaskConical, experimental: true },
      { view: 'triz', label: 'TRIZ Matrix', icon: Grid3X3, experimental: true },
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
                    {item.icon && <item.icon size={18} />}
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
