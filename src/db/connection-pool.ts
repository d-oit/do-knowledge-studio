import { logger } from '../lib/logger';

/**
 * Connection Manager for SQLite WASM Worker
 * Manages a single Web Worker and queues requests to ensure sequential processing
 * and keep the main thread responsive.
 */

interface PoolRequest {
  id: string;
  type: 'init' | 'exec' | 'close';
  payload: unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

export class ConnectionPool {
  private worker: Worker | null = null;
  private busy = false;
  private queue: PoolRequest[] = [];
  private workerUrl: URL;
  private initialized = false;

  constructor() {
    // We use a relative path that Vite will handle
    this.workerUrl = new URL('./db-worker.ts', import.meta.url);
  }

  async init(schema?: string): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing SQLite worker');
    this.worker = new Worker(this.workerUrl, { type: 'module' });

    const id = crypto.randomUUID();
    await this.sendToWorker('init', { schema }, id);
    this.initialized = true;
    logger.info('SQLite worker initialized');
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

  async close(): Promise<void> {
    if (!this.worker) return;
    await this.enqueue('close', {});
    this.worker.terminate();
    this.worker = null;
    this.initialized = false;
  }

  private enqueue(type: PoolRequest['type'], payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.queue.push({ id, type, payload, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.busy || this.queue.length === 0 || !this.worker) return;

    const request = this.queue.shift()!;
    this.busy = true;

    this.sendToWorker(request.type, request.payload, request.id)
      .then(result => {
        this.busy = false;
        request.resolve(result);
        this.processQueue();
      })
      .catch(error => {
        this.busy = false;
        request.reject(error);
        this.processQueue();
      });
  }

  private sendToWorker(type: string, payload: unknown, id: string): Promise<unknown> {
    const w = this.worker;
    if (!w) return Promise.reject(new Error('Worker not initialized'));

    return new Promise((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          w.removeEventListener('message', handler);
          if (event.data.success) {
            resolve(event.data.data);
          } else {
            reject(new Error(event.data.error));
          }
        }
      };

      w.addEventListener('message', handler);
      w.postMessage({ id, type, payload });
    });
  }
}
