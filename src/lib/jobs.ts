import { logger } from './logger';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobMetrics {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  coalesced: number;
  totalExecutionTime: number;
}

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: unknown;
  execute: (signal: AbortSignal) => Promise<T>;
  onComplete?: (result: T) => void;
  onError?: (error: Error) => void;
  coalesceKey?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
class JobCoordinator {
  private queue: Job<any>[] = [];
  private activeJobs = new Map<string, { job: Job<any>; controller: AbortController }>();
  private metrics: JobMetrics = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    coalesced: 0,
    totalExecutionTime: 0,
  };
  private listeners: ((metrics: JobMetrics) => void)[] = [];

  enqueue<T>(job: Job<T>) {
    if (job.coalesceKey) {
      const existingIndex = this.queue.findIndex(j => j.coalesceKey === job.coalesceKey);
      if (existingIndex !== -1) {
        this.queue.splice(existingIndex, 1);
        this.metrics.coalesced++;
      }

      const activeJob = this.activeJobs.get(job.coalesceKey);
      if (activeJob) {
        activeJob.controller.abort();
        this.activeJobs.delete(job.coalesceKey);
        this.metrics.cancelled++;
        this.metrics.running--;
      }
    }

    this.queue.push(job);
    this.metrics.queued++;
    this.notify();
    this.processQueue();
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.activeJobs.size >= 4) return;

    const job = this.queue.shift()!;
    this.metrics.queued--;
    this.metrics.running++;
    this.notify();

    const controller = new AbortController();
    const key = job.coalesceKey || job.id;
    this.activeJobs.set(key, { job, controller });

    const startTime = performance.now();
    try {
      const result = await job.execute(controller.signal);
      if (!controller.signal.aborted) {
        this.metrics.completed++;
        job.onComplete?.(result);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Handled as cancellation
      } else {
        logger.error(`Job ${job.id} (${job.type}) failed`, err);
        this.metrics.failed++;
        job.onError?.(err as Error);
      }
    } finally {
      if (!controller.signal.aborted) {
        this.activeJobs.delete(key);
        this.metrics.running--;
      }
      this.metrics.totalExecutionTime += performance.now() - startTime;
      this.notify();
      this.processQueue();
    }
  }

  subscribe(listener: (metrics: JobMetrics) => void) {
    this.listeners.push(listener);
    listener({ ...this.metrics });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.metrics }));
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

export const jobCoordinator = new JobCoordinator();
