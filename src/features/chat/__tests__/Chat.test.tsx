import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../lib/search', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import Chat from '../Chat';

describe('Chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Chat />);
    expect(screen.getByText('Ask your library')).toBeDefined();
  });

  it('renders the ask input field', () => {
    render(<Chat />);
    const input = screen.getByPlaceholderText('Ask anything about your knowledge...');
    expect(input).toBeDefined();
  });

  it('shows local-only badge', () => {
    render(<Chat />);
    expect(screen.getByText('Local search only')).toBeDefined();
  });

  it('shows offline ready badge', () => {
    render(<Chat />);
    expect(screen.getByText('Offline ready')).toBeDefined();
  });
});
