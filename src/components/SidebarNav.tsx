import React from 'react';

type View = 'editor' | 'graph' | 'mindmap' | 'chat' | 'export' | 'ai';

interface SidebarNavProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  onClose?: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ currentView, setCurrentView, onClose }) => {
  const handleNavClick = (view: View) => {
    setCurrentView(view);
    if (onClose) onClose();
  };

  const getLabel = (view: View) => {
    switch (view) {
      case 'mindmap': return 'Mind Map';
      case 'ai': return 'AI Harness';
      default: return view.charAt(0).toUpperCase() + view.slice(1);
    }
  };

  return (
    <nav className="sidebar-nav">
      <div className="brand">Knowledge Studio</div>
      <ul className="nav-links">
        {(['editor', 'graph', 'mindmap', 'chat', 'export', 'ai'] as View[]).map((view) => (
          <li key={view}>
            <button
              className={`nav-button ${currentView === view ? 'active' : ''}`}
              onClick={() => handleNavClick(view)}
              aria-current={currentView === view ? 'page' : undefined}
            >
              {getLabel(view)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default SidebarNav;
