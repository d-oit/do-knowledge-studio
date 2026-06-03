import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

const TestComponent = ({ active }: { active: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);

  return (
    <div ref={ref}>
      <button type="button" data-testid="b1">Button 1</button>
      <input data-testid="input" />
      <button type="button" data-testid="b2">Button 2</button>
    </div>
  );
};

describe('useFocusTrap', () => {
  it('focuses the first element when active', () => {
    render(<TestComponent active={true} />);
    const b1 = screen.getByTestId('b1');
    expect(document.activeElement).toBe(b1);
  });

  it('traps focus on Tab', () => {
    render(<TestComponent active={true} />);
    const b1 = screen.getByTestId('b1');
    const b2 = screen.getByTestId('b2');

    // Start at last element
    b2.focus();
    expect(document.activeElement).toBe(b2);

    // Tab from last to first
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(b1);
  });

  it('traps focus on Shift+Tab', () => {
    render(<TestComponent active={true} />);
    const b1 = screen.getByTestId('b1');
    const b2 = screen.getByTestId('b2');

    // Start at first element
    b1.focus();
    expect(document.activeElement).toBe(b1);

    // Shift+Tab from first to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(b2);
  });

  it('does nothing when inactive', () => {
    render(<TestComponent active={false} />);
    const b1 = screen.getByTestId('b1');
    expect(document.activeElement).not.toBe(b1);
  });
});
