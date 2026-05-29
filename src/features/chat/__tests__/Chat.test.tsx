import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/search', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import Chat from '../Chat';

const mockOnCreateEntity = vi.fn();

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Chat onCreateEntity={mockOnCreateEntity} />);
    expect(screen.getByText('Ask your library')).toBeDefined();
  });

  it('renders the ask input field', () => {
    render(<Chat onCreateEntity={mockOnCreateEntity} />);
    const input = screen.getByPlaceholderText('Ask anything about your knowledge...');
    expect(input).toBeDefined();
  });

  it('shows local-only badge', () => {
    render(<Chat onCreateEntity={mockOnCreateEntity} />);
    expect(screen.getByText('Local search only')).toBeDefined();
  });

  it('shows offline ready badge', () => {
    render(<Chat onCreateEntity={mockOnCreateEntity} />);
    expect(screen.getByText('Offline ready')).toBeDefined();
  });
});
