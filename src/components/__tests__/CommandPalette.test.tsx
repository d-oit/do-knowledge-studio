import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CommandPalette from '../CommandPalette';
import { searchKnowledge } from '../../lib/search';

// Mock searchKnowledge
vi.mock('../../lib/search', () => ({
  searchKnowledge: vi.fn(),
}));

describe('CommandPalette', () => {
  const mockOnClose = vi.fn();
  const mockOnViewChange = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );
    expect(screen.getByPlaceholderText(/Search commands or knowledge/i)).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CommandPalette
        isOpen={false}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when Escape is pressed', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );
    const input = screen.getByPlaceholderText(/Search commands or knowledge/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the overlay', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );
    const overlay = document.querySelector('.command-palette-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('debounces and calls searchKnowledge', async () => {
    vi.mocked(searchKnowledge).mockResolvedValue([
      { id: '1', title: 'Result 1', type: 'entity', content: 'content' }
    ]);

    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );

    const input = screen.getByPlaceholderText(/Search commands or knowledge/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    await waitFor(() => {
      expect(searchKnowledge).toHaveBeenCalledWith('test query');
    }, { timeout: 500 });

    expect(await screen.findByText('Result 1')).toBeDefined();
  });

  it('navigates through commands with ArrowDown/ArrowUp', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );

    const commands = screen.getAllByRole('button').filter(el => el.className.includes('command-item'));

    // Initially first item is selected
    expect(commands[0].className).toContain('selected');

    const input = screen.getByPlaceholderText(/Search commands or knowledge/i);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(commands[0].className).not.toContain('selected');
    expect(commands[1].className).toContain('selected');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(commands[0].className).toContain('selected');
  });

  it('executes a navigation command on Enter', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );

    const input = screen.getByPlaceholderText(/Search commands or knowledge/i);
    // Select second command (Go to Graph)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnViewChange).toHaveBeenCalledWith('graph');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('executes an action command on Enter', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={mockOnClose}
        onViewChange={mockOnViewChange}
        onAction={mockOnAction}
      />
    );

    const input = screen.getByPlaceholderText(/Search commands or knowledge/i);
    // Go to "Create New Entity" (it's the 7th command)
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnAction).toHaveBeenCalledWith('act-new');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
