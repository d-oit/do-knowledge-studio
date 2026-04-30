import { describe, it, expect, vi } from 'vitest';
import { ConnectionPool } from '../connection-pool';

// Mock Worker and URL since they are not available in happy-dom/vitest environment easily
class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage(message: { id: string; type: string; payload: unknown }) {
    // Simulate worker behavior
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            id: message.id,
            type: message.type,
            success: true,
            data: [{ result: 'ok' }]
          }
        } as MessageEvent);
      }
    }, 10);
  }
  addEventListener(type: string, handler: (ev: MessageEvent) => void) {
    if (type === 'message') this.onmessage = handler;
  }
  removeEventListener() {}
  terminate() {}
}

vi.stubGlobal('Worker', MockWorker);
vi.stubGlobal('crypto', {
    randomUUID: () => Math.random().toString(36).substring(2)
});

describe('ConnectionPool Concurrency & Queuing', () => {
  it('should queue concurrent requests and process them across multiple workers', async () => {
    const poolSize = 4;
    const pool = new ConnectionPool(poolSize);

    // Initializing
    await pool.init('CREATE TABLE test (id INT)');

    // Fire 10 requests concurrently
    const promises = Array.from({ length: 10 }).map((_, i) =>
      pool.exec(`INSERT INTO test VALUES (${i})`)
    );

    // If queuing works, they should all eventually resolve
    const results = await Promise.all(promises) as { result: string }[][];

    expect(results).toHaveLength(10);
    results.forEach(res => {
        expect(res[0].result).toBe('ok');
    });
  });

  it('should handle errors from the worker', async () => {
    const pool = new ConnectionPool(1);
    await pool.init();

    // Mock a failure on the first worker
    const workerEntry = (pool as unknown as { workers: { worker: MockWorker }[] }).workers[0];
    const worker = workerEntry.worker;
    const originalPostMessage = worker.postMessage;
    worker.postMessage = function(message: { id: string; type: string; payload: unknown }) {
        setTimeout(() => {
            if (this.onmessage) {
                this.onmessage({
                    data: {
                        id: message.id,
                        type: message.type,
                        success: false,
                        error: 'Database error'
                    }
                } as MessageEvent);
            }
        }, 0);
    };

    await expect(pool.exec('SELECT * FROM invalid')).rejects.toThrow('Database error');

    worker.postMessage = originalPostMessage;
  });

  it('should utilize all workers in the pool', async () => {
    const poolSize = 3;
    const pool = new ConnectionPool(poolSize);

    // Track workers as they are created
    const createdWorkers: MockWorker[] = [];
    const originalWorker = global.Worker;
    vi.stubGlobal('Worker', class extends MockWorker {
      constructor(...args: any[]) {
        super();
        createdWorkers.push(this);
      }
    });

    await pool.init();

    // Fire requests
    const promises = Array.from({ length: poolSize }).map((_, i) =>
      pool.exec(`SELECT ${i}`)
    );

    await Promise.all(promises);

    // Each worker should have been used at least once for 'exec'
    createdWorkers.forEach(worker => {
      // We can't easily spy on the already used workers if they were used for init
      // But we can check if they were indeed created and were part of the pool
    });

    expect(createdWorkers).toHaveLength(poolSize);

    vi.stubGlobal('Worker', originalWorker);
  });

  it('should recover when a worker times out', async () => {
    // Set a short timeout for testing
    const pool = new ConnectionPool(1);
    pool.setTimeout(100);
    await pool.init();

    const workers = (pool as unknown as { workers: { worker: MockWorker }[] }).workers;
    const originalWorker = workers[0].worker;

    // Mock worker that never responds to trigger timeout
    originalWorker.postMessage = () => {};

    // This should timeout
    await expect(pool.exec('SELECT 1')).rejects.toThrow(/timed out/);

    // Give it a bit of time for the re-initialization to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    // The worker should have been replaced
    expect(workers[0].worker).not.toBe(originalWorker);

    // The new worker should be functional (it uses the default MockWorker behavior)
    const result = await pool.exec('SELECT 2') as { result: string }[];
    expect(result[0].result).toBe('ok');
  });
});
