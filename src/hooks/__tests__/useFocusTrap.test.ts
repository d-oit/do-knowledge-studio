import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

describe('useFocusTrap', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <button id="first">First</button>
      <input id="input" type="text" />
      <button id="last">Last</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it('should focus first focusable element when activated', () => {
    const firstButton = container.querySelector('#first') as HTMLElement;
    firstButton.focus();

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });

    expect(document.activeElement).toBe(firstButton);
  });

  it('should restore previous focus on deactivation', () => {
    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    const { result, rerender } = renderHook(
      ({ active }) => {
        const ref = useRef<HTMLDivElement>(container);
        useFocusTrap(ref, active);
        return ref;
      },
      { initialProps: { active: true } }
    );

    rerender({ active: false });

    expect(document.activeElement).toBe(outsideButton);
    document.body.removeChild(outsideButton);
  });

  it('should wrap focus from last to first on Tab', () => {
    const lastButton = container.querySelector('#last') as HTMLElement;
    lastButton.focus();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
    });
    document.dispatchEvent(tabEvent);

    const firstButton = container.querySelector('#first') as HTMLElement;
    expect(document.activeElement).toBe(firstButton);
  });

  it('should wrap focus from first to last on Shift+Tab', () => {
    const firstButton = container.querySelector('#first') as HTMLElement;
    firstButton.focus();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    });
    document.dispatchEvent(shiftTabEvent);

    const lastButton = container.querySelector('#last') as HTMLElement;
    expect(document.activeElement).toBe(lastButton);
  });

  it('should not manage focus when inactive', () => {
    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, false);
      return ref;
    });

    expect(document.activeElement).toBe(outsideButton);
    document.body.removeChild(outsideButton);
  });

  it('should handle empty focusable elements', () => {
    const emptyContainer = document.createElement('div');
    document.body.appendChild(emptyContainer);

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(emptyContainer);
      useFocusTrap(ref, true);
      return ref;
    });

    // Should not throw and focus should remain on body or previous element
    expect(document.activeElement).toBeDefined();

    document.body.removeChild(emptyContainer);
  });
});
