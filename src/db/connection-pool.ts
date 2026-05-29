import { logger } from '../lib/logger';

export const DEFAULT_POOL_SIZE = 2;
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default timeout

/**
 * Connection Manager for SQLite WASM Worker Pool
 * Manages multiple Web Workers and queues requests to ensure efficient
 * parallel processing while keeping the main thread responsive.
 */

interface PoolRequest {
  id: string;
  type: 'init' | 'exec' | 'close';
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

interface WorkerEntry {
  worker: Worker;
  busy: boolean;
  initialized: boolean;
}

export class ConnectionPool {
  private workers: WorkerEntry[] = [];
  private queue: PoolRequest[] = [];
  private initialized = false;
  private timeoutMs = DEFAULT_TIMEOUT_MS;
  private poolSize: number;
  private schema: string | undefined;

  constructor(poolSize: number = DEFAULT_POOL_SIZE) {
    this.poolSize = Math.max(1, Math.min(poolSize, 16));
  }

  /**
   * Set custom timeout for queries (in milliseconds)
   */
  setTimeout(ms: number): void {
    this.timeoutMs = Math.max(100, Math.min(ms, 120000));
    logger.info(`Connection pool timeout set to ${this.timeoutMs}ms`);
  }

  async init(schema?: string): Promise<void> {
    if (this.initialized) return;

    this.schema = schema;
    logger.info(`Initializing SQLite worker pool with size ${this.poolSize}`);

    const results = await Promise.allSettled(
      Array.from({ length: this.poolSize }).map((_, i) => {
        const workerEntry = this.createWorker();
        this.workers.push(workerEntry);
        return this.initializeWorker(workerEntry, i);
      })
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    if (succeeded === 0) {
      throw new Error('All workers failed to initialize');
    }

    this.initialized = true;
    logger.info(`SQLite worker pool initialized (${succeeded}/${this.poolSize} workers ready)`);
  }

  private createWorker(): WorkerEntry {
    const worker = new Worker(new URL('./db-worker.ts', import.meta.url), { type: 'module' });
    return {
      worker,
      busy: false,
      initialized: false
    };
  }

  private async initializeWorker(entry: WorkerEntry, index: number, retries = 2): Promise<void> {
    const id = crypto.randomUUID();
    try {
      await this.sendToWorker(entry, 'init', { schema: this.schema }, id);
      entry.initialized = true;
      logger.info(`Worker ${index} initialized`);
      // Trigger queue processing now that a new worker is available
      this.processQueue();
    } catch (err) {
      if (retries > 0) {
        logger.warn(`Worker ${index} init failed, retrying (${retries} left)`, err);
        entry.worker.terminate();
        const newEntry = this.createWorker();
        this.workers[this.workers.indexOf(entry)] = newEntry;
        return this.initializeWorker(newEntry, index, retries - 1);
      }
      logger.error(`Failed to initialize worker ${index}`, err);
      throw err;
    }
  }

  async exec(options: string | {
    sql: string;
    bind?: (string | number | boolean | null)[];
    returnValue?: string;
    rowMode?: string
  }): Promise<unknown> {
    const payload = typeof options === 'string' ? { sql: options } : options;
    return this.enqueue('exec', payload);
  }

  async transaction(statements: { sql: string; bind?: (string | number | boolean | null)[] }[]): Promise<unknown[]> {
    return this.enqueue('transaction', { statements }) as Promise<unknown[]>;
  }

  async close(): Promise<void> {
    const closePromises = this.workers.map(async (entry) => {
      if (entry.worker) {
        // Try to close gracefully, but don't wait too long
        await Promise.race([
          this.sendToWorker(entry, 'close', {}, crypto.randomUUID()),
          new Promise(resolve => setTimeout(resolve, 1000))
        ]).catch((err) => {
           logger.debug('Worker close timed out or failed', err);
        });
        entry.worker.terminate();
      }
    });

    await Promise.all(closePromises);
    this.workers = [];
    this.initialized = false;
    logger.info('SQLite worker pool closed');
  }

  private enqueue(type: PoolRequest['type'], payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.queue.push({ id, type, payload, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0) return;

    // Find all available and initialized workers
    const availableWorkers = this.workers.filter(w => !w.busy && w.initialized);

    while (availableWorkers.length > 0 && this.queue.length > 0) {
      const workerEntry = availableWorkers.shift();
      const request = this.queue.shift();

      if (workerEntry && request) {
        workerEntry.busy = true;

        this.sendToWorker(workerEntry, request.type, request.payload, request.id)
          .then(result => {
            workerEntry.busy = false;
            request.resolve(result);
            this.processQueue();
          })
          .catch(error => {
            workerEntry.busy = false;
            request.reject(error);
            this.processQueue();
          });
      }
    }
  }

  private sendToWorker(entry: WorkerEntry, type: string, payload: unknown, id: string): Promise<unknown> {
    const worker = entry.worker;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Find index of worker to replace it
        const index = this.workers.indexOf(entry);
        if (index !== -1) {
          logger.error(`Worker ${index} timeout after ${this.timeoutMs}ms for request ${id}. Replacing worker.`);
          worker.terminate();

          // Replace worker
          const newEntry = this.createWorker();
          this.workers[index] = newEntry;
          this.initializeWorker(newEntry, index).catch(err => {
             logger.error(`Failed to re-initialize replaced worker ${index}`, err);
          });
        }

        reject(new Error(`Database operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          clearTimeout(timeoutId);
          worker.removeEventListener('message', handler);
          if (event.data.success) {
            resolve(event.data.data);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ id, type, payload });
    });
  }
}
