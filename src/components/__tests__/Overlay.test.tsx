import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Overlay from '../Overlay';

describe('Overlay', () => {
  it('renders children when open', () => {
    render(<Overlay isOpen={true} onClose={vi.fn()}><div>Content</div></Overlay>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<Overlay isOpen={false} onClose={vi.fn()}><div>Content</div></Overlay>);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<Overlay isOpen={true} onClose={onClose}><div>Content</div></Overlay>);
    const backdrop = container.querySelector('[role="presentation"]')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
