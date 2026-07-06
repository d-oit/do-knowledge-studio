import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TrizMatrix from '../TrizMatrix';

describe('TrizMatrix', () => {
  const onClose = vi.fn();

  it('renders the panel with title', () => {
    render(<TrizMatrix onClose={onClose} />);
    expect(screen.getByText('TRIZ Contradiction Matrix')).toBeInTheDocument();
  });

  it('shows step 1 prompt initially', () => {
    render(<TrizMatrix onClose={onClose} />);
    expect(screen.getByText(/Step 1.*Improving Parameter/)).toBeInTheDocument();
  });

  it('renders engineering parameters list', () => {
    render(<TrizMatrix onClose={onClose} />);
    expect(screen.getByText(/Weight of Moving Object/)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('advances to step 2 after selecting improving parameter', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    expect(screen.getByText(/Step 2.*Worsening Parameter/)).toBeInTheDocument();
    expect(screen.getByText(/Improving:/)).toBeInTheDocument();
  });

  it('shows suggested principles after selecting both parameters', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    fireEvent.click(screen.getByText(/Weight of Non-Moving Object/));
    expect(screen.getByText(/Suggested Inventive Principles/)).toBeInTheDocument();
  });

  it('displays principle details when expanded', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    fireEvent.click(screen.getByText(/Weight of Non-Moving Object/));

    const principleButtons = screen.getAllByText(/^#\d+/);
    if (principleButtons.length > 0) {
      fireEvent.click(principleButtons[0]);
      expect(screen.getByText('Examples:')).toBeInTheDocument();
    }
  });

  it('resets selection when reset button is clicked', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    expect(screen.getByText(/Step 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
  });

  it('resets from results view', () => {
    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    fireEvent.click(screen.getByText(/Weight of Non-Moving Object/));

    fireEvent.click(screen.getByText('Try Another Contradiction'));
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
  });

  it('copies principle to clipboard', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<TrizMatrix onClose={onClose} />);
    fireEvent.click(screen.getByText(/Weight of Moving Object/));
    fireEvent.click(screen.getByText(/Weight of Non-Moving Object/));

    const principleButtons = screen.getAllByText(/^#\d+/);
    if (principleButtons.length > 0) {
      fireEvent.click(principleButtons[0]);
      const copyBtn = screen.getByText('Copy');
      fireEvent.click(copyBtn);
      expect(writeText).toHaveBeenCalled();
      expect(screen.getByText('Copied')).toBeInTheDocument();
    }
  });
});
