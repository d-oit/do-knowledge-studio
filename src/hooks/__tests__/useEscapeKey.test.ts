import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from '../useEscapeKey';

describe('useEscapeKey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onClose when Escape is pressed and active', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, true));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when other key is pressed', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, true));

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when not active', () => {
    const onClose = vi.fn();
    renderHook(() => useEscapeKey(onClose, false));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes listener when unmounted', () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(onClose, true));

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes listener when active becomes false', () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useEscapeKey(onClose, active),
      { initialProps: { active: true } }
    );

    rerender({ active: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
