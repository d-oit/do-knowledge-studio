import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DbProvider, DbContext } from '../DbProvider';
import { useDb } from '../useDb';

// Mock the initDb function
vi.mock('../../db/client', () => ({
  initDb: vi.fn(),
}));

// Mock the repository
vi.mock('../../db/repository', () => ({
  repository: {
    listEntities: vi.fn().mockResolvedValue([]),
  },
}));

// Mock the logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DbProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children when database is ready', async () => {
    const { initDb } = await import('../../db/client');
    vi.mocked(initDb).mockResolvedValue(undefined);

    render(
      <DbProvider>
        <div data-testid="child">Test Child</div>
      </DbProvider>
    );

    // Wait for the database to initialize
    await vi.waitFor(() => {
      expect(screen.getByTestId('child')).toBeTruthy();
    });
  });

  it('should show error state on failure', async () => {
    const { initDb } = await import('../../db/client');
    vi.mocked(initDb).mockRejectedValue(new Error('DB Error'));

    const ErrorConsumer = () => {
      const context = React.useContext(DbContext);
      if (context?.error) {
        return <div data-testid="error">{context.error}</div>;
      }
      return null;
    };

    render(
      <DbProvider>
        <ErrorConsumer />
      </DbProvider>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('error')).toBeTruthy();
      expect(screen.getByTestId('error').textContent).toBe('Failed to initialize local database');
    });
  });

  it('should provide repository in context', async () => {
    const { initDb } = await import('../../db/client');
    vi.mocked(initDb).mockResolvedValue(undefined);

    const ContextConsumer = () => {
      const context = React.useContext(DbContext);
      return (
        <div data-testid="has-repository">{context?.repository ? 'yes' : 'no'}</div>
      );
    };

    render(
      <DbProvider>
        <ContextConsumer />
      </DbProvider>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('has-repository').textContent).toBe('yes');
    });
  });

  it('should set dbReady to true after initialization', async () => {
    const { initDb } = await import('../../db/client');
    vi.mocked(initDb).mockResolvedValue(undefined);

    const StateConsumer = () => {
      const context = React.useContext(DbContext);
      return (
        <div data-testid="db-ready">{context?.dbReady ? 'ready' : 'not ready'}</div>
      );
    };

    render(
      <DbProvider>
        <StateConsumer />
      </DbProvider>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('db-ready').textContent).toBe('ready');
    });
  });

  it('throws when useDb is used outside DbProvider', () => {
    const UseDbConsumer = () => {
      useDb();
      return null;
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<UseDbConsumer />)).toThrow('useDb must be used within a DbProvider');

    consoleErrorSpy.mockRestore();
  });
});
