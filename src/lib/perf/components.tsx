import React, { Profiler, type ProfilerOnRenderCallback } from 'react';
import { perf } from './index.js';

const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

interface ProfiledProps {
  id: string;
  children: React.ReactNode;
}

export const Profiled: React.FC<ProfiledProps> = ({ id, children }) => {
  if (!isDev) return <>{children}</>;

  const onRender: ProfilerOnRenderCallback = (_id, phase, actualDuration) => {
    const arr = (perf as unknown as { _entries: { name: string; duration: number; timestamp: number }[] })._entries;
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

export const PerfPanel: React.FC<PerfPanelProps> = ({ isOpen, onClose }) => {
  if (!isDev || !isOpen) return null;

  const currentEntries = perf.getEntries();

  const avgDuration = (name: string): string => {
    const matches = currentEntries.filter(e => e.name === name);
    if (matches.length === 0) return '\u2014';
    const avg = matches.reduce((sum, e) => sum + e.duration, 0) / matches.length;
    return `${avg.toFixed(1)}ms`;
  };

  const count = (name: string): number =>
    currentEntries.filter(e => e.name === name).length;

  const measureNames = [...new Set(currentEntries.map(e => e.name))];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '8px',
        right: '8px',
        width: '380px',
        maxHeight: '60vh',
        background: 'var(--bg-elevated, #1e1e2e)',
        border: '1px solid var(--border-default, #444)',
        borderRadius: '8px',
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
      <div
        style={{
          padding: '8px 12px',
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {currentEntries.length === 0 && (
          <div style={{ color: 'var(--text-muted, #888)', padding: '12px 0', textAlign: 'center' }}>
            No performance data yet. Interact with the app to collect measurements.
          </div>
        )}
        {measureNames.map(name => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: '1px solid var(--border-default, #333)',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </span>
            <span style={{ marginLeft: '8px', textAlign: 'right', minWidth: '60px', color: 'var(--status-info, #60a5fa)' }}>
              {avgDuration(name)}
            </span>
            <span style={{ marginLeft: '8px', textAlign: 'right', minWidth: '30px', color: 'var(--text-muted, #888)' }}>
              x{count(name)}
            </span>
          </div>
        ))}
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
        <span>{currentEntries.length} measurements</span>
        <button
          onClick={() => { perf.clear(); }}
          style={{
            background: 'none',
            border: '1px solid var(--border-default, #555)',
            borderRadius: '4px',
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
