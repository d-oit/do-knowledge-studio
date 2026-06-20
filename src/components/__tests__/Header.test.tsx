import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../Header';

describe('Header', () => {
  it('renders mobile brand', () => {
    render(<Header onMenuClick={vi.fn()} onSearchClick={vi.fn()} />);
    expect(screen.getByText('Knowledge Studio')).toBeInTheDocument();
  });

  it('calls onMenuClick when menu button is clicked', () => {
    const onMenuClick = vi.fn();
    render(<Header onMenuClick={onMenuClick} onSearchClick={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it('calls onSearchClick when search button is clicked', () => {
    const onSearchClick = vi.fn();
    render(<Header onMenuClick={vi.fn()} onSearchClick={onSearchClick} />);
    fireEvent.click(screen.getByLabelText('Open search'));
    expect(onSearchClick).toHaveBeenCalled();
  });
});
