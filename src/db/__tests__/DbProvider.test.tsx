import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useContext } from 'react';
import { render, screen, act } from '@testing-library/react';
import { DbProvider, DbContext } from '../DbProvider';

vi.mock('../client', () => ({
  initDb: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../repository', () => ({
  repository: { entities: { getAll: vi.fn() } },
}));

import { initDb } from '../client';

function TestConsumer() {
  const ctx = useContext(DbContext);
  if (!ctx) return <div data-testid="no-context">No context</div>;
  return (
    <div>
      <span data-testid="db-ready">{String(ctx.dbReady)}</span>
      <span data-testid="error">{ctx.error ?? ''}</span>
    </div>
  );
}

describe('DbProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children and shows dbReady=true after init succeeds', async () => {
    (initDb as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/require-await -- act requires async wrapper for Promise-based mocks
    await act(async () => {
      render(
        <DbProvider>
          <TestConsumer />
        </DbProvider>
      );
    });

    expect(screen.getByTestId('db-ready').textContent).toBe('true');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('shows error state when initDb rejects', async () => {
    (initDb as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    // eslint-disable-next-line @typescript-eslint/require-await -- act requires async wrapper for Promise-based mocks
    await act(async () => {
      render(
        <DbProvider>
          <TestConsumer />
        </DbProvider>
      );
    });

    expect(screen.getByTestId('db-ready').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('Failed to initialize local database');
  });

  it('provides repository in context', () => {
    (initDb as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    let capturedCtx: ReturnType<typeof useContext> = null;

    function ConsumerCapture() {
      // eslint-disable-next-line react-hooks/globals -- test-only pattern to capture context value
      capturedCtx = useContext(DbContext);
      return <div>ok</div>;
    }

    act(() => {
      render(
        <DbProvider>
          <ConsumerCapture />
        </DbProvider>
      );
    });

    expect(capturedCtx).toBeDefined();
    expect(capturedCtx!.repository).toBeDefined();
  });

  it('DbContext returns undefined when used outside provider', () => {
    function OutsideConsumer() {
      const ctx = useContext(DbContext);
      return <div data-testid="ctx-val">{ctx === undefined ? 'undefined' : 'defined'}</div>;
    }

    render(<OutsideConsumer />);
    expect(screen.getByTestId('ctx-val').textContent).toBe('undefined');
  });

  it('starts with dbReady=false before init resolves', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- simulates pending promise
    (initDb as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    render(
      <DbProvider>
        <TestConsumer />
      </DbProvider>
    );

    expect(screen.getByTestId('db-ready').textContent).toBe('false');
  });
});
