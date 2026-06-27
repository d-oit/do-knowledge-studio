import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ClaimMetadataPopover } from '../ClaimMetadataPopover';

describe('ClaimMetadataPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default values', () => {
    render(<ClaimMetadataPopover source="" verificationStatus="unverified" onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Claim Metadata')).toBeDefined();
    expect(screen.getByLabelText('Source')).toBeDefined();
    expect(screen.getByLabelText('Verification')).toBeDefined();
  });

  it('calls onSave with source and status', () => {
    const onSave = vi.fn();
    render(<ClaimMetadataPopover source="" verificationStatus="unverified" onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Wikipedia' } });
    fireEvent.change(screen.getByLabelText('Verification'), { target: { value: 'verified' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('Wikipedia', 'verified');
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<ClaimMetadataPopover source="" verificationStatus="unverified" onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<ClaimMetadataPopover source="" verificationStatus="unverified" onSave={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
