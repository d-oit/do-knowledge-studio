import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Profiled, PerfPanel } from '../components';
import { perf } from '../core';

vi.mock('../core', () => ({
  perf: {
    _entries: [],
    getEntries: vi.fn(() => []),
    getStatsByCategory: vi.fn(() => new Map()),
    clear: vi.fn(),
  },
}));

describe('Profiled', () => {
  it('renders children', () => {
    render(<Profiled id="test"><span>hello</span></Profiled>);
    expect(screen.getByText('hello')).toBeDefined();
  });
});

describe('PerfPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (perf._entries as unknown[]).length = 0;
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<PerfPanel isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when isOpen is true', () => {
    render(<PerfPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('shows empty state when no entries', () => {
    (perf.getEntries as ReturnType<typeof vi.fn>).mockReturnValue([]);
    render(<PerfPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/No performance data yet/)).toBeDefined();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PerfPanel isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls perf.clear when Clear button clicked', () => {
    render(<PerfPanel isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(perf.clear).toHaveBeenCalled();
  });

  it('renders categories with metrics', () => {
    const mockStats = new Map([
      ['SQLite', [
        { name: 'sqlite:query', count: 5, avgMs: 12.3, minMs: 8.1, maxMs: 20.5, lastMs: 15.0 },
      ]],
    ]);
    (perf.getStatsByCategory as ReturnType<typeof vi.fn>).mockReturnValue(mockStats);
    (perf.getEntries as ReturnType<typeof vi.fn>).mockReturnValue([{ name: 'sqlite:query' }]);

    render(<PerfPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('SQLite')).toBeDefined();
    expect(screen.getByText('sqlite:query')).toBeDefined();
  });

  it('collapses category on click', () => {
    const mockStats = new Map([
      ['SQLite', [
        { name: 'sqlite:query', count: 5, avgMs: 12.3, minMs: 8.1, maxMs: 20.5, lastMs: 15.0 },
      ]],
    ]);
    (perf.getStatsByCategory as ReturnType<typeof vi.fn>).mockReturnValue(mockStats);
    (perf.getEntries as ReturnType<typeof vi.fn>).mockReturnValue([{ name: 'sqlite:query' }]);

    render(<PerfPanel isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('sqlite:query')).toBeDefined();

    fireEvent.click(screen.getByText('SQLite'));
    expect(screen.queryByText('sqlite:query')).toBeNull();
  });
});
