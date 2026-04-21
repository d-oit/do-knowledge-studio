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
  it('should queue concurrent requests and process them sequentially', async () => {
    const pool = new ConnectionPool();

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
    const pool = new ConnectionPool();
    await pool.init();

    // Mock a failure
    const worker = (pool as unknown as { worker: MockWorker }).worker;
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
});
