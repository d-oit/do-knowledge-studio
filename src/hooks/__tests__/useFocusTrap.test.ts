import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

function createContainer() {
  const container = document.createElement('div');
  container.innerHTML = `
    <button id="btn1">First</button>
    <input id="input1" type="text" />
    <button id="btn2">Last</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'activeElement', {
      value: document.body,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('focuses the first focusable element on activation', () => {
    const container = createContainer();
    const focusSpy = vi.spyOn(container.querySelector('#btn1') as HTMLElement, 'focus');

    renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('wraps focus from last to first on Tab', () => {
    const container = createContainer();
    document.body.appendChild(container);

    renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    const lastBtn = container.querySelector('#btn2') as HTMLElement;
    lastBtn.focus();
    Object.defineProperty(document, 'activeElement', {
      value: lastBtn,
      writable: true,
      configurable: true,
    });

    const firstBtn = container.querySelector('#btn1') as HTMLElement;
    const focusSpy = vi.spyOn(firstBtn, 'focus');

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('wraps focus from first to last on Shift+Tab', () => {
    const container = createContainer();
    document.body.appendChild(container);

    renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    const firstBtn = container.querySelector('#btn1') as HTMLElement;
    firstBtn.focus();
    Object.defineProperty(document, 'activeElement', {
      value: firstBtn,
      writable: true,
      configurable: true,
    });

    const lastBtn = container.querySelector('#btn2') as HTMLElement;
    const focusSpy = vi.spyOn(lastBtn, 'focus');

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(focusSpy).toHaveBeenCalled();
  });

  it('restores previous focus on unmount', () => {
    const container = createContainer();
    const previousFocus = document.createElement('button');
    previousFocus.id = 'previous';
    document.body.appendChild(previousFocus);

    Object.defineProperty(document, 'activeElement', {
      value: previousFocus,
      writable: true,
      configurable: true,
    });

    const restoreSpy = vi.spyOn(previousFocus, 'focus');

    const { unmount } = renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    unmount();
    expect(restoreSpy).toHaveBeenCalled();
  });

  it('does not manage focus when inactive', () => {
    const container = createContainer();
    const focusSpy = vi.spyOn(container.querySelector('#btn1') as HTMLElement, 'focus');

    renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, false);
      return r;
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('handles empty focusable elements without errors', () => {
    const container = document.createElement('div');
    container.innerHTML = '<div>No focusable elements</div>';
    document.body.appendChild(container);

    expect(() => {
      renderHook(() => {
        const r = useRef<HTMLDivElement>(null);
        (r).current = container;
        useFocusTrap(r, true);
        return r;
      });
    }).not.toThrow();
  });

  it('does not wrap when Tab is pressed on non-boundary element', () => {
    const container = createContainer();
    document.body.appendChild(container);

    renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    const middleInput = container.querySelector('#input1') as HTMLElement;
    middleInput.focus();
    Object.defineProperty(document, 'activeElement', {
      value: middleInput,
      writable: true,
      configurable: true,
    });

    const firstBtn = container.querySelector('#btn1') as HTMLElement;
    const lastBtn = container.querySelector('#btn2') as HTMLElement;
    const firstSpy = vi.spyOn(firstBtn, 'focus');
    const lastSpy = vi.spyOn(lastBtn, 'focus');

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstSpy).not.toHaveBeenCalled();
    expect(lastSpy).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const container = createContainer();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => {
      const r = useRef<HTMLDivElement>(null);
      (r).current = container;
      useFocusTrap(r, true);
      return r;
    });

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
