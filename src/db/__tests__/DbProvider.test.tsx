import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useContext } from 'react';
import { DbProvider, DbContext } from '../DbProvider';
import { initDb } from '../client';

vi.mock('../client', () => ({
  initDb: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const TestConsumer = () => {
  const context = useContext(DbContext);
  if (!context) return <div>No Context</div>;
  return (
    <div>
      <div data-testid="db-ready">{context.dbReady ? 'ready' : 'not-ready'}</div>
      <div data-testid="db-error">{context.error || 'no-error'}</div>
    </div>
  );
};

describe('DbProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides ready state when initDb succeeds', async () => {
    vi.mocked(initDb).mockResolvedValue({} as any);

    render(
      <DbProvider>
        <TestConsumer />
      </DbProvider>
    );

    expect(screen.getByTestId('db-ready')).toHaveTextContent('not-ready');

    await waitFor(() => {
      expect(screen.getByTestId('db-ready')).toHaveTextContent('ready');
    });
    expect(screen.getByTestId('db-error')).toHaveTextContent('no-error');
  });

  it('provides error state when initDb fails', async () => {
    vi.mocked(initDb).mockRejectedValue(new Error('Failed'));

    render(
      <DbProvider>
        <TestConsumer />
      </DbProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('db-error')).toHaveTextContent('Failed to initialize local database');
    });
    expect(screen.getByTestId('db-ready')).toHaveTextContent('not-ready');
  });
});
