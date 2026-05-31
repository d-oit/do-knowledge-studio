import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock heavy tiptap dependencies
vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    getHTML: () => '<p>test</p>',
    commands: {
      setContent: vi.fn(),
      focus: vi.fn().mockReturnValue({ toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }) }),
    },
    isActive: vi.fn().mockReturnValue(false),
    chain: vi.fn().mockReturnValue({
      focus: vi.fn().mockReturnValue({
        toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
        toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
        toggleClaim: vi.fn().mockReturnValue({ run: vi.fn() }),
        setMention: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    }),
    state: {
      doc: {
        descendants: vi.fn(),
      },
    },
  }),
  EditorContent: () => <div data-testid="tiptap-editor" />,
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../db/repository', () => ({
  repository: {
    createEntity: vi.fn().mockResolvedValue({ id: '1', name: 'Test', type: 'note', description: '<p>test</p>', metadata: {} }),
    getAllEntities: vi.fn().mockResolvedValue([]),
    getBacklinks: vi.fn().mockResolvedValue([]),
    getBacklinkCount: vi.fn().mockResolvedValue(0),
    transaction: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/jobs', () => ({
  jobCoordinator: {
    enqueue: vi.fn(),
    registerHandler: vi.fn(),
  },
}));

vi.mock('../../../lib/perf', () => ({
  perf: {
    mark: vi.fn(),
    measure: vi.fn(),
  },
}));

import Editor from '../Editor';

describe('Editor Progressive Disclosure (#143)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides source URL and mention sections when Advanced is collapsed', () => {
    render(<Editor />);

    const advancedBtn = screen.getByLabelText('Toggle advanced options');
    expect(advancedBtn).toBeDefined();
    expect(advancedBtn).toHaveAttribute('aria-expanded', 'false');

    // Source URL input should not be visible
    const sourceInput = screen.queryByPlaceholderText('Source URL — auto-hydrate description');
    expect(sourceInput).toBeNull();

    // Mention button should not be visible
    const mentionBtn = screen.queryByLabelText('Link to Entity');
    expect(mentionBtn).toBeNull();
  });

  it('shows source URL and mention sections when Advanced is expanded', () => {
    render(<Editor />);

    const advancedBtn = screen.getByLabelText('Toggle advanced options');
    fireEvent.click(advancedBtn);

    expect(advancedBtn).toHaveAttribute('aria-expanded', 'true');

    // Source URL input should now be visible
    const sourceInput = screen.getByPlaceholderText('Source URL — auto-hydrate description');
    expect(sourceInput).toBeDefined();

    // Mention button should now be visible
    const mentionBtn = screen.getByLabelText('Link to Entity');
    expect(mentionBtn).toBeDefined();
  });

  it('toggles Advanced section on repeated clicks', () => {
    render(<Editor />);

    const advancedBtn = screen.getByLabelText('Toggle advanced options');

    // First click — expand
    fireEvent.click(advancedBtn);
    expect(screen.getByPlaceholderText('Source URL — auto-hydrate description')).toBeDefined();

    // Second click — collapse
    fireEvent.click(advancedBtn);
    expect(screen.queryByPlaceholderText('Source URL — auto-hydrate description')).toBeNull();
  });

  it('renders primary editor controls always visible', () => {
    render(<Editor />);

    // Title input and type select should always be visible
    expect(screen.getByPlaceholderText('Entity Name (e.g. TRIZ)')).toBeDefined();
    expect(screen.getByLabelText('Entity Type')).toBeDefined();
    expect(screen.getByText('Save to DB')).toBeDefined();
  });
});
