import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { renderWithDb } from '../../../test/test-utils';

// Stable mock for editor to prevent infinite re-render loops in tests
const mockEditor = {
  getHTML: () => '<p>test</p>',
  commands: {
    setContent: vi.fn(),
    focus: vi.fn().mockReturnValue({ toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }) }),
  },
  isActive: vi.fn().mockReturnValue(false),
  can: vi.fn().mockReturnValue({ undo: vi.fn().mockReturnValue(false), redo: vi.fn().mockReturnValue(false) }),
  chain: vi.fn().mockReturnValue({
    focus: vi.fn().mockReturnValue({
      toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleHeading: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleClaim: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleCodeBlock: vi.fn().mockReturnValue({ run: vi.fn() }),
      toggleBlockquote: vi.fn().mockReturnValue({ run: vi.fn() }),
      extendMarkRange: vi.fn().mockReturnValue({ setLink: vi.fn().mockReturnValue({ run: vi.fn() }) }),
      undo: vi.fn().mockReturnValue({ run: vi.fn() }),
      redo: vi.fn().mockReturnValue({ run: vi.fn() }),
      setMention: vi.fn().mockReturnValue({ run: vi.fn() }),
    }),
  }),
  state: {
    doc: {
      descendants: vi.fn(),
    },
  },
};

// Mock heavy tiptap dependencies
vi.mock('@tiptap/react', () => ({
  useEditor: () => mockEditor,
  EditorContent: () => <div data-testid="tiptap-editor" />,
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {},
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn(),
  },
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  }),
}));

vi.mock('lucide-react', () => ({
  CheckCircle: () => <div />,
  AtSign: () => <div />,
  Link2: () => <div />,
  ChevronDown: () => <div />,
  ChevronRight: () => <div />,
  Pencil: () => <div />,
  Undo2: () => <div />,
  Redo2: () => <div />,
  Sparkles: () => <div />,
  X: () => <div />,
}));

vi.mock('../ClaimExtension', () => ({
  ClaimExtension: {},
}));

vi.mock('../MentionExtension', () => ({
  MentionExtension: {},
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
    transaction: vi.fn().mockResolvedValue(void 0),
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

vi.mock('../../../lib/search', () => ({
  upsertToSearchIndex: vi.fn().mockResolvedValue(void 0),
  removeFromSearchIndex: vi.fn().mockResolvedValue(void 0),
  hydrateOramaIndex: vi.fn(),
}));

import { IRepository } from '../../../db/repository/types';
import Editor from '../Editor';

describe('Editor Progressive Disclosure (#143)', () => {
  const mockRepo = {
    createEntity: vi.fn(),
    getAllEntities: vi.fn().mockResolvedValue([]),
    getBacklinks: vi.fn().mockResolvedValue([]),
    getBacklinkCount: vi.fn().mockResolvedValue(0),
    transaction: vi.fn(),
    getEntityById: vi.fn().mockResolvedValue(null),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    getClaimsByEntityId: vi.fn(),
  } as unknown as IRepository;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides source URL and mention sections when Advanced is collapsed', () => {
    act(() => {
      renderWithDb(<Editor />, { repository: mockRepo });
    });

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
    act(() => {
      renderWithDb(<Editor />, { repository: mockRepo });
    });

    const advancedBtn = screen.getByLabelText('Toggle advanced options');
    act(() => {
      fireEvent.click(advancedBtn);
    });

    expect(advancedBtn).toHaveAttribute('aria-expanded', 'true');

    // Source URL input should now be visible
    const sourceInput = screen.getByPlaceholderText('Source URL — auto-hydrate description');
    expect(sourceInput).toBeDefined();

    // Mention button should now be visible
    const mentionBtn = screen.getByLabelText('Link to Entity');
    expect(mentionBtn).toBeDefined();
  });

  it('toggles Advanced section on repeated clicks', () => {
    act(() => {
      renderWithDb(<Editor />, { repository: mockRepo });
    });

    const advancedBtn = screen.getByLabelText('Toggle advanced options');

    // First click — expand
    act(() => {
      fireEvent.click(advancedBtn);
    });
    expect(screen.getByPlaceholderText('Source URL — auto-hydrate description')).toBeDefined();

    // Second click — collapse
    act(() => {
      fireEvent.click(advancedBtn);
    });
    expect(screen.queryByPlaceholderText('Source URL — auto-hydrate description')).toBeNull();
  });

  it('renders primary editor controls always visible', () => {
    act(() => {
      renderWithDb(<Editor />, { repository: mockRepo });
    });

    // Title input and type select should always be visible
    expect(screen.getByPlaceholderText('Entity Name (e.g. TRIZ)')).toBeDefined();
    expect(screen.getByLabelText('Entity Type')).toBeDefined();
    expect(screen.getByText('Save to DB')).toBeDefined();
  });
});
