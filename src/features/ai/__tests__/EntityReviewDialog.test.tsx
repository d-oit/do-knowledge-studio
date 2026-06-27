import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../db/useRepository', () => ({
  useRepository: () => ({
    createEntity: vi.fn().mockResolvedValue({ id: 'e1', name: 'Test', type: 'concept' }),
    createLink: vi.fn().mockResolvedValue({ id: 'l1' }),
    getEntityByName: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('../../../lib/ai/graph-linker', () => ({
  applyEntitiesToGraph: vi.fn().mockResolvedValue({ created: 2, linked: 1 }),
}));

vi.mock('../../../components/Overlay', () => ({
  default: ({ children, isOpen, onClose: _onClose, ariaLabel }: { children: React.ReactNode; isOpen: boolean; onClose: () => void; ariaLabel?: string }) =>
    isOpen ? <div role="dialog" aria-label={ariaLabel}>{children}<button onClick={_onClose}>Close</button></div> : null,
}));

import EntityReviewDialog from '../EntityReviewDialog';

const mockResult = {
  entities: [
    { name: 'React', type: 'tech', description: 'UI library' },
    { name: 'TypeScript', type: 'tech', description: 'Type system' },
  ],
  relationships: [
    { from: 'React', to: 'TypeScript', label: 'uses' },
  ],
};

describe('EntityReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders entity checkboxes', () => {
    render(<EntityReviewDialog result={mockResult} onClose={vi.fn()} onComplete={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders relationship section', () => {
    render(<EntityReviewDialog result={mockResult} onClose={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText(/relationships/)).toBeDefined();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<EntityReviewDialog result={mockResult} onClose={onClose} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('applies entities and calls onComplete', async () => {
    const onComplete = vi.fn();
    render(<EntityReviewDialog result={mockResult} onClose={vi.fn()} onComplete={onComplete} />);
    const applyBtn = screen.getByText(/Add Selected to Graph/);
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
