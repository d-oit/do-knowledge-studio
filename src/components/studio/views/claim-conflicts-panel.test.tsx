import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClaimConflictsPanel } from './claim-conflicts-panel';

vi.mock('@/lib/studio/store', () => ({
  useStudioStore: (sel: (s: Record<string, unknown>) => unknown) => {
    const state = {
      claims: [
        { id: 'c1', entityId: 'e1', statement: 'The sky is blue', confidence: 0.8, verification: 'unverified' },
        { id: 'c2', entityId: 'e1', statement: 'The sky is blue', confidence: 0.6, verification: 'unverified' },
      ],
      entities: [{ id: 'e1', name: 'Sky' }],
      deleteClaim: vi.fn(),
      updateClaim: vi.fn(),
    };
    return sel(state);
  },
}));

describe('ClaimConflictsPanel', () => {
  it('labels flags as suggestions and lists the pair', async () => {
    render(<ClaimConflictsPanel />);
    expect(await screen.findByText(/Automatic suggestions only/i)).toBeInTheDocument();
    expect(await screen.findByText(/Duplicate/i)).toBeInTheDocument();
  });
});
