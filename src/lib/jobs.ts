import { logger } from './logger';

export type JobType = 'reindex-document' | 'refresh-search-index' | 'recompute-neighborhood' | 'prepare-export';

export interface Job {
  id: string;
  type: JobType;
  targetId?: string;
  payload?: any;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface JobMetrics {
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  coalesced: number;
  avgWaitTime: number;
  avgExecutionTime: number;
}

export type JobHandler = (payload: any, signal?: AbortSignal) => Promise<any>;

export class JobCoordinator {
  private queue: Job[] = [];
  private currentJob: Job | null = null;
  private abortController: AbortController | null = null;

  private metrics = {
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    coalescedCount: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
  };

  private handlers: Map<JobType, JobHandler> = new Map();

  constructor() {
    this.processQueue = this.processQueue.bind(this);
  }

  registerHandler(type: JobType, handler: JobHandler) {
    this.handlers.set(type, handler);
    logger.info(`Job handler registered for: ${type}`);
  }

  enqueue(type: JobType, targetId?: string, payload?: any): string {
    // Coalesce: if a job of the same type and targetId is already queued, update it
    if (targetId) {
      const existingJob = this.queue.find(j => j.type === type && j.targetId === targetId && j.status === 'queued');
      if (existingJob) {
        existingJob.payload = payload;
        // Keep original enqueuedAt to track total wait time accurately,
        // OR update it if we consider it a "new" request.
        // The requirement says "fast edit bursts do not create redundant work".
        // Updating the payload is the key.
        this.metrics.coalescedCount++;
        return existingJob.id;
      }
    }

    const job: Job = {
      id: crypto.randomUUID(),
      type,
      targetId,
      payload,
      status: 'queued',
      enqueuedAt: Date.now(),
    };

    this.queue.push(job);

    // Trigger queue processing
    setTimeout(this.processQueue, 0);

    return job.id;
  }

  private async processQueue() {
    if (this.currentJob || this.queue.length === 0) return;

    this.currentJob = this.queue.shift()!;
    this.currentJob.status = 'running';
    this.currentJob.startedAt = Date.now();

    const waitTime = this.currentJob.startedAt - this.currentJob.enqueuedAt;
    this.metrics.totalWaitTime += waitTime;

    this.abortController = new AbortController();

    try {
      const handler = this.handlers.get(this.currentJob.type);
      if (handler) {
        await handler(this.currentJob.payload, this.abortController.signal);
        this.currentJob.status = 'completed';
        this.metrics.completedCount++;
      } else {
        logger.warn(`No handler registered for job type: ${this.currentJob.type}`);
        this.currentJob.status = 'failed';
        this.currentJob.error = 'No handler registered';
        this.metrics.failedCount++;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.currentJob.status = 'cancelled';
        this.metrics.cancelledCount++;
      } else {
        logger.error(`Job failed: ${this.currentJob.type}`, err);
        this.currentJob.status = 'failed';
        this.currentJob.error = err instanceof Error ? err.message : String(err);
        this.metrics.failedCount++;
      }
    } finally {
      this.currentJob.completedAt = Date.now();
      const executionTime = this.currentJob.completedAt - this.currentJob.startedAt;
      this.metrics.totalExecutionTime += executionTime;

      this.currentJob = null;
      this.abortController = null;
      setTimeout(this.processQueue, 0);
    }
  }

  getMetrics(): JobMetrics {
    const finishedCount = this.metrics.completedCount + this.metrics.failedCount;
    const avgWaitTime = finishedCount > 0 ? this.metrics.totalWaitTime / finishedCount : 0;
    const avgExecutionTime = finishedCount > 0 ? this.metrics.totalExecutionTime / finishedCount : 0;

    return {
      queued: this.queue.length,
      running: this.currentJob ? 1 : 0,
      completed: this.metrics.completedCount,
      failed: this.metrics.failedCount,
      cancelled: this.metrics.cancelledCount,
      coalesced: this.metrics.coalescedCount,
      avgWaitTime,
      avgExecutionTime,
    };
  }
}

export const jobCoordinator = new JobCoordinator();
