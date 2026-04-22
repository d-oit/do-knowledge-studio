import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobCoordinator } from '../jobs';

describe('JobCoordinator', () => {
  let coordinator: JobCoordinator;

  beforeEach(() => {
    coordinator = new JobCoordinator();
    // Use fake timers to control processQueue
    vi.useFakeTimers();
  });

  it('should enqueue and process a job', async () => {
    const handler = vi.fn().mockResolvedValue('result');
    coordinator.registerHandler('reindex-document', handler);

    coordinator.enqueue('reindex-document', '1', { data: 'test' });

    expect(coordinator.getMetrics().queued).toBe(1);

    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith({ data: 'test' }, expect.any(AbortSignal));
    expect(coordinator.getMetrics().completed).toBe(1);
    expect(coordinator.getMetrics().queued).toBe(0);
  });

  it('should coalesce jobs of same type and targetId', async () => {
    const handler = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    coordinator.registerHandler('reindex-document', handler);

    coordinator.enqueue('reindex-document', '1', { version: 1 });
    coordinator.enqueue('reindex-document', '1', { version: 2 });
    coordinator.enqueue('reindex-document', '1', { version: 3 });

    expect(coordinator.getMetrics().queued).toBe(1);
    expect(coordinator.getMetrics().coalesced).toBe(2);

    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ version: 3 }, expect.any(AbortSignal));
  });

  it('should handle failed jobs', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Failed'));
    coordinator.registerHandler('reindex-document', handler);

    coordinator.enqueue('reindex-document', '1');

    await vi.runAllTimersAsync();

    expect(coordinator.getMetrics().failed).toBe(1);
  });

  it('should calculate metrics correctly', async () => {
    const handler = vi.fn().mockImplementation(async () => {
        // Mock some execution time if needed, but here we just check counts
    });
    coordinator.registerHandler('reindex-document', handler);

    coordinator.enqueue('reindex-document', '1');
    coordinator.enqueue('reindex-document', '2');

    await vi.runAllTimersAsync();

    const metrics = coordinator.getMetrics();
    expect(metrics.completed).toBe(2);
    expect(metrics.avgWaitTime).toBeGreaterThanOrEqual(0);
    expect(metrics.avgExecutionTime).toBeGreaterThanOrEqual(0);
  });
});
