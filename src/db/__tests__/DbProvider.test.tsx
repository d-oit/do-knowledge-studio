/**
 * Unit tests for DbProvider component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../../db/client', () => ({
  initDb: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { DbProvider, DbContext } from '../DbProvider';

describe('DbProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when database initializes', async () => {
    render(
      <DbProvider>
        <div data-testid="child">Hello</div>
      </DbProvider>,
    );
    expect(screen.getByTestId('child').textContent).toBe('Hello');
  });

  it('exposes a context value with repository reference', () => {
    let ctxValue: unknown = null;
    function Probe(): React.ReactElement {
      const ctx = React.useContext(DbContext);
      ctxValue = ctx;
      return <div />;
    }
    render(
      <DbProvider>
        <Probe />
      </DbProvider>,
    );
    expect(ctxValue).toBeTruthy();
    expect(ctxValue).toHaveProperty('repository');
    expect((ctxValue as { dbReady: boolean }).dbReady).toBe(false);
  });
});
