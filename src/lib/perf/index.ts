const PERF_PREFIX = 'perf::';

interface PerfEntry {
  name: string;
  duration: number;
  timestamp: number;
}

const entries: PerfEntry[] = [];
const MAX_ENTRIES = 500;

const isDev = typeof window !== 'undefined' && import.meta.env.DEV;

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
};

export { Profiled, PerfPanel } from './components.js';
