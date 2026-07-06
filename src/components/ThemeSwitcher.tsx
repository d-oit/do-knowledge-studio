import React from 'react';
import { Palette, Monitor, Gamepad2, Brain, Wrench } from 'lucide-react';

export type Theme = 'app' | 'game' | 'neural' | 'technical';

interface ThemeOption {
  theme: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    theme: 'app',
    label: 'Default',
    icon: <Monitor size={18} />,
    description: 'Professional light interface',
  },
  {
    theme: 'game',
    label: 'Tactical',
    icon: <Gamepad2 size={18} />,
    description: 'High-contrast neon dark',
  },
  {
    theme: 'neural',
    label: 'Neural',
    icon: <Brain size={18} />,
    description: 'Soft organic palette',
  },
  {
    theme: 'technical',
    label: 'Technical',
    icon: <Wrench size={18} />,
    description: 'Brutalist mono style',
  },
];

const STORAGE_KEY = 'do-knowledge-studio-theme';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['app', 'game', 'neural', 'technical'].includes(stored)) {
      return stored as Theme;
    }
  } catch {
    // localStorage unavailable (e.g. private browsing, SSR)
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'game' : 'app';
  } catch {
    return 'app';
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (e.g. private browsing, SSR)
  }
}

interface ThemeSwitcherProps {
  compact?: boolean;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ compact = false }) => {
  const [activeTheme, setActiveTheme] = React.useState<Theme>(getStoredTheme);
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    storeTheme(activeTheme);
  }, [activeTheme]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.theme-switcher')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSelect = React.useCallback((theme: Theme) => {
    setActiveTheme(theme);
    setIsOpen(false);
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => Math.min(prev + 1, THEME_OPTIONS.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      const option = THEME_OPTIONS.at(focusedIndex);
      if (option) handleSelect(option.theme);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, focusedIndex, handleSelect]);

  const handleDropdownOpen = React.useCallback(() => {
    setIsOpen(true);
    setFocusedIndex(0);
  }, []);

  if (compact) {
    return (
      <div className="theme-switcher theme-switcher-compact">
        <button
          className="theme-toggle-btn"
          onClick={handleDropdownOpen}
          onKeyDown={handleKeyDown}
          aria-label="Switch theme"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <Palette size={18} />
        </button>
        {isOpen && (
          <div
            className="theme-dropdown"
            role="listbox"
            tabIndex={0}
            aria-label="Select theme"
            aria-activedescendant={focusedIndex >= 0 ? `theme-option-${focusedIndex}` : undefined}
            onKeyDown={handleKeyDown}
          >
            {THEME_OPTIONS.map((opt, i) => (
                <div key={opt.theme} role="option" aria-selected={activeTheme === opt.theme} tabIndex={-1}>
                <button
                  id={`theme-option-${i}`}
                  className={`theme-option ${activeTheme === opt.theme ? 'active' : ''}`}
                  onClick={() => handleSelect(opt.theme)}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="theme-switcher">
      <div className="theme-switcher-label">Theme</div>
      <div className="theme-grid">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.theme}
            className={`theme-card ${activeTheme === opt.theme ? 'active' : ''}`}
            onClick={() => handleSelect(opt.theme)}
            aria-pressed={activeTheme === opt.theme}
          >
            <div className="theme-card-preview" data-theme-preview={opt.theme} />
            <div className="theme-card-info">
              <span className="theme-card-icon">{opt.icon}</span>
              <span className="theme-card-label">{opt.label}</span>
            </div>
            <div className="theme-card-desc">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
