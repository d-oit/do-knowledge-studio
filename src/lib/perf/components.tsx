import React, { Profiler, useState, type ProfilerOnRenderCallback } from 'react';
import { perf } from './index.js';

const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

interface ProfiledProps {
  id: string;
  children: React.ReactNode;
}

export const Profiled: React.FC<ProfiledProps> = ({ id, children }) => {
  if (!isDev) return <>{children}</>;

  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    const arr = perf._entries;
    arr.push({
      name: `react:${_id}`,
      duration: actualDuration,
      timestamp: Date.now(),
    });
  };

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
};

interface PerfPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER = [
  'App Boot', 'React Render', 'Search UI', 'Orama Search',
  'SQLite', 'FTS Indexing', 'Graph Rendering', 'Mind Map',
  'Editor', 'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  'App Boot': 'var(--status-info)',
  'React Render': 'var(--status-info)',
  'Search UI': 'var(--status-success)',
  'Orama Search': 'var(--status-success)',
  'SQLite': 'var(--status-warning)',
  'FTS Indexing': 'var(--status-warning)',
  'Graph Rendering': 'var(--status-danger)',
  'Mind Map': 'var(--status-danger)',
  'Editor': 'var(--status-info)',
  'Other': 'var(--text-muted)',
};

function durationColor(ms: number): string {
  if (ms < 16) return 'var(--status-success)';
  if (ms < 100) return 'var(--status-warning)';
  return 'var(--status-danger)';
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)}ms`;
}

export const PerfPanel: React.FC<PerfPanelProps> = ({ isOpen, onClose }) => {
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  if (!isDev || !isOpen) return null;

  const byCategory = perf.getStatsByCategory();
  const totalEntries = perf.getEntries().length;

  const toggleCat = (cat: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        width: '420px',
        maxHeight: '70vh',
        background: 'var(--bg-elevated, #1e1e2e)',
        border: '1px solid var(--border-default, #444)',
        borderRadius: 'var(--radius-base, 8px)',
        zIndex: 9999,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '11px',
        color: 'var(--text-primary, #eee)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
      role="dialog"
      aria-label="Performance Panel"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-default, #444)',
          background: 'var(--bg-surface, #2a2a3e)',
        }}
      >
        <strong style={{ fontSize: '13px' }}>Performance Panel</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)' }}>{totalEntries} measurements</span>
          <button
            onClick={onClose}
            aria-label="Close performance panel"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #aaa)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 8px',
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            {'\u2715'}
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '4px 12px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {totalEntries === 0 && (
          <div style={{ color: 'var(--text-muted, #888)', padding: '12px 0', textAlign: 'center' }}>
            No performance data yet. Interact with the app to collect measurements.
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 50px 50px 50px 50px',
            gap: '4px',
            padding: '4px 0',
            borderBottom: '1px solid var(--border-default, #333)',
            color: 'var(--text-muted)',
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-elevated)',
          }}
        >
          <span>Metric</span>
          <span style={{ textAlign: 'right' }}>Avg</span>
          <span style={{ textAlign: 'right' }}>Min</span>
          <span style={{ textAlign: 'right' }}>Max</span>
          <span style={{ textAlign: 'right' }}>Count</span>
        </div>

        {CATEGORY_ORDER.filter(cat => byCategory.has(cat)).map(cat => {
          const stats = byCategory.get(cat)!;
          const isCollapsed = collapsedCats.has(cat);

          return (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '6px 0',
                  border: 'none',
                  borderBottom: '1px solid var(--border-default, #333)',
                  background: 'transparent',
                  color: CATEGORY_COLORS[cat] || 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans, sans-serif)',
                  minHeight: '44px',
                }}
              >
                <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 100ms' }}>
                  {'\u25BC'}
                </span>
                {cat}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 400 }}>
                  {stats.length} metrics
                </span>
              </button>

              {!isCollapsed && stats.map(s => {
                const color = durationColor(s.avgMs);
                const barWidth = Math.min(s.avgMs / 500 * 100, 100);
                return (
                  <div
                    key={s.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 50px 50px 50px 50px',
                      gap: '4px',
                      padding: '3px 0',
                      borderBottom: '1px solid var(--border-default, #222)',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '2px',
                          width: `${barWidth}%`,
                          background: color,
                          borderRadius: '1px',
                          flexShrink: 0,
                          maxWidth: '60px',
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name.replace(/^react:/, '').replace(/^sqlite-/, '').replace(/^orama-/, '')}
                      </span>
                    </div>
                    <span style={{ textAlign: 'right', color }}>{formatMs(s.avgMs)}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{formatMs(s.minMs)}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatMs(s.maxMs)}</span>
                    <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>x{s.count}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--border-default, #444)',
          fontSize: '10px',
          color: 'var(--text-muted, #888)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span><span style={{ color: 'var(--status-success)' }}>{'\u2B24'}</span> {'<'}16ms</span>
          <span><span style={{ color: 'var(--status-warning)' }}>{'\u2B24'}</span> {'<'}100ms</span>
          <span><span style={{ color: 'var(--status-danger)' }}>{'\u2B24'}</span> 100ms+</span>
        </span>
        <button
          onClick={() => { perf.clear(); }}
          style={{
            background: 'none',
            border: '1px solid var(--border-default, #555)',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--text-secondary, #aaa)',
            cursor: 'pointer',
            fontSize: '10px',
            padding: '4px 8px',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
};
