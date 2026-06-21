import { describe, it, expect, vi } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  it('logs info', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    logger.info('test', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[INFO] test', '{\n  "key": "val"\n}');
    spy.mockRestore();
  });

  it('logs warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    logger.warn('test', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[WARN] test', '{\n  "key": "val"\n}');
    spy.mockRestore();
  });

  it('logs error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    logger.error('test', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[ERROR] test', '{\n  "key": "val"\n}');
    spy.mockRestore();
  });

  it('logs debug when DEV is true', () => {
    // Mock import.meta.env.DEV
    vi.stubGlobal('import', { meta: { env: { DEV: true } } });
    const spy = vi.spyOn(console, 'debug').mockImplementation(vi.fn());
    logger.debug('test', { key: 'val' });
    expect(spy).toHaveBeenCalledWith('[DEBUG] test', '{\n  "key": "val"\n}');
    spy.mockRestore();
    vi.unstubAllGlobals();
  });
});
