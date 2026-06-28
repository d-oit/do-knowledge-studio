/**
 * Routing memory for external URL resolution.
 *
 * Tracks success/failure rates per domain to enable circuit-breaker
 * behavior: skip failing domains, prefer reliable ones.
 */

const STORAGE_KEY = 'dks:routing-memory';
const FAILURE_THRESHOLD = 3;
const HALF_OPEN_AFTER_MS = 5 * 60 * 1000; // 5 minutes

interface DomainStats {
  successes: number;
  failures: number;
  lastFailure: number;
  lastSuccess: number;
  state: 'closed' | 'open' | 'half-open';
}

let memory: Map<string, DomainStats> = new Map();

function loadMemory(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as [string, DomainStats][];
      memory = new Map(parsed);
    }
  } catch {
    memory = new Map();
  }
}

function saveMemory(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...memory.entries()]));
  } catch {
    // localStorage unavailable — fail silently
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function recordSuccess(url: string): void {
  const domain = getDomain(url);
  const stats = memory.get(domain) ?? { successes: 0, failures: 0, lastFailure: 0, lastSuccess: 0, state: 'closed' as const };
  stats.successes++;
  stats.lastSuccess = Date.now();
  stats.state = 'closed';
  memory.set(domain, stats);
  saveMemory();
}

export function recordFailure(url: string): void {
  const domain = getDomain(url);
  const stats = memory.get(domain) ?? { successes: 0, failures: 0, lastFailure: 0, lastSuccess: 0, state: 'closed' as const };
  stats.failures++;
  stats.lastFailure = Date.now();
  if (stats.failures >= FAILURE_THRESHOLD) {
    stats.state = 'open';
  }
  memory.set(domain, stats);
  saveMemory();
}

export function shouldSkip(url: string): boolean {
  const domain = getDomain(url);
  const stats = memory.get(domain);
  if (!stats) return false;

  if (stats.state === 'open') {
    // Half-open after cooldown
    if (Date.now() - stats.lastFailure > HALF_OPEN_AFTER_MS) {
      stats.state = 'half-open';
      memory.set(domain, stats);
      saveMemory();
      return false;
    }
    return true;
  }

  return false;
}

export function getDomainStats(url: string): DomainStats | null {
  return memory.get(getDomain(url)) ?? null;
}

export function getAllStats(): Map<string, DomainStats> {
  loadMemory();
  return new Map(memory);
}

export function resetMemory(): void {
  memory = new Map();
  saveMemory();
}

// Initialize on module load
loadMemory();
