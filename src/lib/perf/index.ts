const PERF_PREFIX = 'perf::';

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
}

interface PerfStats {
  name: string;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}

const entries: PerfEntry[] = [];
const MAX_ENTRIES = 500;

const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

function computeStats(name: string, items: PerfEntry[]): PerfStats {
  const durations = items.map(e => e.duration);
  return {
    name,
    count: items.length,
    avgMs: items.length > 0 ? durations.reduce((a, b) => a + b, 0) / items.length : 0,
    minMs: items.length > 0 ? Math.min(...durations) : 0,
    maxMs: items.length > 0 ? Math.max(...durations) : 0,
    lastMs: items.length > 0 ? durations[durations.length - 1] : 0,
  };
}

function categorize(name: string): string {
  if (name.startsWith('react:')) return 'React Render';
  if (name.startsWith('sqlite')) return 'SQLite';
  if (name.startsWith('orama')) return 'Orama Search';
  if (name.startsWith('search')) return 'Search UI';
  if (name.startsWith('app-')) return 'App Boot';
  if (name.startsWith('graph')) return 'Graph Rendering';
  if (name.startsWith('mindmap')) return 'Mind Map';
  if (name.startsWith('editor')) return 'Editor';
  if (name.startsWith('fts')) return 'FTS Indexing';
  return 'Other';
}

export const perf = {
  /** @internal */
  _entries: entries,
  mark(name: string): void {
    if (!isDev) return;
    try {
      performance.mark(`${PERF_PREFIX}${name}`);
    } catch {
      // silently ignore in unsupported environments
    }
  },

  measure(name: string, startMark: string, endMark?: string): number | null {
    if (!isDev) return null;
    try {
      const start = `${PERF_PREFIX}${startMark}`;
      const end = endMark ? `${PERF_PREFIX}${endMark}` : undefined;
      performance.measure(name, start, end);
      const measure = performance.getEntriesByName(name).pop();
      if (measure) {
        const entry: PerfEntry = {
          name,
          duration: measure.duration,
          timestamp: Date.now(),
        };
        entries.push(entry);
        if (entries.length > MAX_ENTRIES) entries.shift();
        return measure.duration;
      }
      return null;
    } catch {
      return null;
    }
  },

  clear(): void {
    if (!isDev) return;
    entries.length = 0;
    try {
      performance.clearMarks();
      performance.clearMeasures();
    } catch {
      // ignore
    }
  },

  getEntries(): readonly PerfEntry[] {
    return entries;
  },

  getEntriesByName(name: string): PerfEntry[] {
    return entries.filter(e => e.name === name);
  },

  getStats(name: string): PerfStats | null {
    const items = entries.filter(e => e.name === name);
    if (items.length === 0) return null;
    return computeStats(name, items);
  },

  getAllStats(): PerfStats[] {
    const grouped = new Map<string, PerfEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.name) || [];
      list.push(entry);
      grouped.set(entry.name, list);
    }
    return Array.from(grouped.entries()).map(([name, items]) => computeStats(name, items));
  },

  getStatsByCategory(): Map<string, PerfStats[]> {
    const grouped = new Map<string, PerfEntry[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.name) || [];
      list.push(entry);
      grouped.set(entry.name, list);
    }
    const byCategory = new Map<string, PerfStats[]>();
    for (const [name, items] of grouped) {
      const cat = categorize(name);
      const list = byCategory.get(cat) || [];
      list.push(computeStats(name, items));
      byCategory.set(cat, list);
    }
    return byCategory;
  },
};

export { Profiled, PerfPanel } from './components.js';
