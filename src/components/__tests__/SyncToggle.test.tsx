import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SyncToggle from '../SyncToggle';
import { useGraphSyncStore } from '../../store/graph-sync-store';

vi.mock('../../store/graph-sync-store', () => ({
  useGraphSyncStore: vi.fn(),
}));

describe('SyncToggle', () => {
  it('renders sync status', () => {
    (useGraphSyncStore as ReturnType<typeof vi.fn>).mockReturnValue({
      syncEnabled: true,
      setSyncEnabled: vi.fn(),
    });
    render(<SyncToggle />);
    expect(screen.getByText('Sync On')).toBeInTheDocument();
  });

  it('toggles sync status', () => {
    const setSyncEnabled = vi.fn();
    (useGraphSyncStore as ReturnType<typeof vi.fn>).mockReturnValue({
      syncEnabled: false,
      setSyncEnabled,
    });
    render(<SyncToggle />);
    fireEvent.click(screen.getByText('Sync Off'));
    expect(setSyncEnabled).toHaveBeenCalledWith(true);
  });
});
