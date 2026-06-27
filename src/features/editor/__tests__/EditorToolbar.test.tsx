import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import EditorToolbar from '../EditorToolbar';

const mockEditor = {
  isActive: vi.fn().mockReturnValue(false),
  can: vi.fn().mockReturnValue({ undo: () => false, redo: () => false }),
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCodeBlock: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleClaim: vi.fn().mockReturnValue({ run: vi.fn() }),
      undo: vi.fn().mockReturnValue({ run: vi.fn() }),
      redo: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  }),
};

const defaultProps = {
  editor: mockEditor as never,
  editingEntityId: null,
  isExtracting: false,
  onExtractEntities: vi.fn(),
  onToggleLinkInput: vi.fn(),
  onToggleClaim: vi.fn(),
  onSave: vi.fn(),
  onCancelEdit: vi.fn(),
};

describe('EditorToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders formatting buttons', () => {
    render(<EditorToolbar {...defaultProps} />);
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('I')).toBeDefined();
    expect(screen.getByText('H1')).toBeDefined();
    expect(screen.getByText('H2')).toBeDefined();
  });

  it('renders action buttons', () => {
    render(<EditorToolbar {...defaultProps} />);
    expect(screen.getByText('Claim')).toBeDefined();
    expect(screen.getByText('AI Extract')).toBeDefined();
  });

  it('renders save button', () => {
    render(<EditorToolbar {...defaultProps} />);
    expect(screen.getByText('Save to DB')).toBeDefined();
  });

  it('shows Update Entity when editing', () => {
    render(<EditorToolbar {...defaultProps} editingEntityId="e1" />);
    expect(screen.getByText('Update Entity')).toBeDefined();
  });

  it('calls onSave when save clicked', () => {
    const onSave = vi.fn();
    render(<EditorToolbar {...defaultProps} onSave={onSave} />);
    fireEvent.click(screen.getByText('Save to DB'));
    expect(onSave).toHaveBeenCalled();
  });

  it('calls onToggleClaim when claim button clicked', () => {
    const onToggleClaim = vi.fn();
    render(<EditorToolbar {...defaultProps} onToggleClaim={onToggleClaim} />);
    fireEvent.click(screen.getByText('Claim'));
    expect(onToggleClaim).toHaveBeenCalled();
  });

  it('calls onCancelEdit when cancel clicked', () => {
    const onCancelEdit = vi.fn();
    render(<EditorToolbar {...defaultProps} editingEntityId="e1" onCancelEdit={onCancelEdit} />);
    fireEvent.click(screen.getByLabelText('Cancel editing'));
    expect(onCancelEdit).toHaveBeenCalled();
  });
});
