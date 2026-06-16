/**
 * Unit tests for the useFocusTrap accessibility hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useFocusTrap } from '../useFocusTrap';

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div');
  const button1 = document.createElement('button');
  button1.textContent = 'First';
  const button2 = document.createElement('button');
  button2.textContent = 'Second';
  const button3 = document.createElement('button');
  button3.textContent = 'Third';
  container.append(button1, button2, button3);
  document.body.appendChild(container);
  return container;
}

describe('useFocusTrap', () => {
  let container: HTMLDivElement;
  let ref: React.RefObject<HTMLDivElement>;

  beforeEach(() => {
    container = makeContainer();
    ref = { current: container };
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('returns null', () => {
    const { result } = renderHook(() => useFocusTrap(ref, true));
    expect(result.current).toBeNull();
  });

  it('focuses the first focusable element on activation', async () => {
    renderHook(() => useFocusTrap(ref, true));
    // The hook defers the initial focus to the next animation frame so
    // the overlay has time to lay out.
    await new Promise(requestAnimationFrame);
    expect(document.activeElement).toBe(container.querySelectorAll('button')[0]);
  });

  it('wraps focus from last to first on Tab', () => {
    renderHook(() => useFocusTrap(ref, true));
    const last = container.querySelectorAll('button')[2];
    last.focus();
    expect(document.activeElement).toBe(last);
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);
    expect(document.activeElement).toBe(container.querySelectorAll('button')[0]);
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    renderHook(() => useFocusTrap(ref, true));
    const first = container.querySelectorAll('button')[0];
    first.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    document.dispatchEvent(event);
    expect(document.activeElement).toBe(container.querySelectorAll('button')[2]);
  });

  it('does not add listeners when inactive', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useFocusTrap(ref, false));
    const keydownCalls = addSpy.mock.calls.filter(c => c[0] === 'keydown');
    expect(keydownCalls).toHaveLength(0);
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useFocusTrap(ref, true));
    unmount();
    const keydownCalls = removeSpy.mock.calls.filter(c => c[0] === 'keydown');
    expect(keydownCalls.length).toBeGreaterThan(0);
  });

  it('handles empty focusable list gracefully', () => {
    const emptyContainer = document.createElement('div');
    document.body.appendChild(emptyContainer);
    const emptyRef = { current: emptyContainer } as React.RefObject<HTMLDivElement>;
    expect(() => renderHook(() => useFocusTrap(emptyRef, true))).not.toThrow();
    document.body.removeChild(emptyContainer);
  });
});
