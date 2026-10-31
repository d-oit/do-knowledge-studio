/**
 * End-to-end coverage for the screen-reader live announcements (Plan 157
 * Phase 5).
 *
 * The `<Announcer />` region was mounted at the root layout but never spoken
 * into. These tests render the real components under a real provider and read
 * the live region's text, so they fail if a mutation goes silent again — the
 * wiring, not just the hook, is the contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent, act, cleanup, waitFor, within } from '@testing-library/react'
import { Announcer } from '@/lib/a11y/announcer'

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <span data-testid="icon" className={className} />
  )
  return {
    Home: Icon,
    Library: Icon,
    GitBranch: Icon,
    MessageSquare: Icon,
    FlaskConical: Icon,
    Grid3X3: Icon,
    Sun: Icon,
    Moon: Icon,
    // The sidebar's theme control renders its pre-mount `system` state with
    // this icon before the stored choice arrives (theme-provider.tsx).
    Monitor: Icon,
    Search: Icon,
    CalendarDays: Icon,
    PanelRight: Icon,
    PanelRightClose: Icon,
    Wifi: Icon,
    // Icons the mind map and its export-types module graph import.
    FileText: Icon,
    FileJson: Icon,
    FileCode: Icon,
    FileArchive: Icon,
    FileLock: Icon,
    BrainCircuit: Icon,
    Plus: Icon,
    Trash2: Icon,
    Edit3: Icon,
    Undo2: Icon,
    Redo2: Icon,
    RefreshCw: Icon,
    Download: Icon,
    ChevronRight: Icon,
    ChevronDown: Icon,
    Sliders: Icon,
    // Chrome of the views the announcement triggers below render.
    X: Icon,
    Tag: Icon,
    Save: Icon,
    AtSign: Icon,
    ExternalLink: Icon,
    ArrowRight: Icon,
    Shield: Icon,
    Sparkles: Icon,
    Check: Icon,
    Upload: Icon,
    Eye: Icon,
    AlertTriangle: Icon,
    ShieldCheck: Icon,
    Loader2: Icon,
    RotateCcw: Icon,
  }
})

// jsdom has no matchMedia; the editor reads it to drop split view when narrow.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

const mockSetTheme = vi.fn()
const mockSetView = vi.fn()
const mockSetCommandOpen = vi.fn()
const mockSetRightPanelOpen = vi.fn()

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mockSetTheme }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}))

/** Entity the mind map renders as its single tree node. */
const mindMapEntity = {
  id: 'e-root',
  name: 'Root Entity',
  type: 'concept' as const,
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

const mockSelectEntity = vi.fn()
const mockCommitEntities = vi.fn()
const mockDeleteEntity = vi.fn()
const mockStartEdit = vi.fn()
const mockUndo = vi.fn()
const mockRedo = vi.fn()
const mockImportWithRollback = vi.fn()
const mockResetStore = vi.fn()
const mockFinishEditing = vi.fn()
const mockNavigateToView = vi.fn()

// One store mock serves both the sidebar (navigation) and the mind map
// (entity tree): a second `vi.mock` for the same module would shadow this one.
vi.mock('@/lib/studio/store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/studio/store')>('@/lib/studio/store')
  return {
    ...actual,
    useStudioStore: (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        currentView,
        setView: mockSetView,
        setCommandOpen: mockSetCommandOpen,
        rightPanelOpen,
        setRightPanelOpen: mockSetRightPanelOpen,
        entities: [mindMapEntity],
        claims: [],
        graph: undefined,
        mindMap: undefined,
        links: [],
        tags: [],
        chat: [],
        selectedEntityId,
        editingEntityId,
        selectEntity: mockSelectEntity,
        commitEntities: mockCommitEntities,
        deleteEntity: mockDeleteEntity,
        startEdit: mockStartEdit,
        finishEditing: mockFinishEditing,
        navigateToView: mockNavigateToView,
        importWithRollback: mockImportWithRollback,
        resetStore: mockResetStore,
        startNew: vi.fn(),
        addClaim: vi.fn(),
        addClaims: vi.fn(),
        updateClaim: vi.fn(),
        deleteClaim: vi.fn(),
        undo: mockUndo,
        redo: mockRedo,
        entityHistory: [[]],
        historyIndex: 0,
      }),
  }
})

vi.mock('./shortcuts-dialog', () => ({
  ShortcutsTrigger: ({ className }: { className?: string }) => (
    <button data-testid="shortcuts-trigger" className={className}>Shortcuts</button>
  ),
}))

let currentView = 'home'
let rightPanelOpen = false
let selectedEntityId: string | null = null
let editingEntityId: string | null = null

// The editor's chrome (toolbar, claims panel, type menu, remote cursors) is not
// on the announcement path, so it is stubbed: these tests assert what the live
// region says, not how those widgets look.
vi.mock('./views/editor-toolbar', () => ({ EditorToolbar: () => <div data-testid="editor-toolbar" /> }))
vi.mock('./views/editor-claims-panel', () => ({ ClaimsPanel: () => <div data-testid="claims-panel" /> }))
vi.mock('./views/type-selector', () => ({ TypeSelector: () => <div data-testid="type-selector" /> }))
vi.mock('./remote-cursors', () => ({
  CursorTracker: ({ children }: { children?: React.ReactNode }) => children,
}))

vi.mock('@/lib/studio/use-reduced-motion', () => ({ useReducedMotion: () => true }))

vi.mock('./shortcuts-dialog', () => ({
  ShortcutsTrigger: ({ className }: { className?: string }) => (
    <button data-testid="shortcuts-trigger" className={className}>Shortcuts</button>
  ),
}))

import { Sidebar } from './sidebar'
import { RightPanel } from './right-panel'
import { MindMapView } from './views/mindmap-view'
import { EditorView } from './views/editor-view'
import { ExportView } from './views/export-view'
import { buildJsonExport } from './views/export-helpers'

/**
 * Renders `ui` under a real live region and returns a reader for the text a
 * screen reader would have spoken. The announcer defers its write by
 * {@link SCREEN_READER_DELAY_MS} so the region re-announces on change, so the
 * reader waits past that delay.
 */
const renderWithAnnouncer = async (ui: React.ReactElement) => {
  const view = render(<Announcer>{ui}</Announcer>)
  // The announcer's own region is the render root's first child. Some views
  // (the editor) mount a `role="status"` region of their own deeper in the
  // tree, where `screen.getByRole('status')` would be ambiguous.
  const region = view.container.querySelector<HTMLElement>(':scope > [role="status"]')
  if (region === null) throw new Error('announcer live region not found')
  const spoken = async () => {
    const { promise, resolve } = Promise.withResolvers<void>()
    setTimeout(resolve, 80)
    await act(async () => { await promise })
    return region.textContent ?? ''
  }
  return { ...view, region, spoken }
}

/** Entity the import fixture replaces the library with (id must not collide with the store fixture). */
const importedEntity = {
  id: 'e-import',
  name: 'Imported Entity',
  type: 'note' as const,
  description: '',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  links: [],
}

/** Claim on {@link importedEntity}; the import parser rejects orphaned claims. */
const importedClaim = {
  id: 'c-import',
  entityId: 'e-import',
  statement: 'Imported claim',
  confidence: 0.8,
  verification: 'unverified' as const,
}

/**
 * Import file built with the app's own exporter, so the fixture cannot drift
 * from the schema `parseImportFile` validates.
 */
const importFileContent = buildJsonExport([importedEntity], [importedClaim])

/**
 * Runs `run` with a synchronous `FileReader` installed: the handler reads the
 * picked file through `readAsText`/`onload`, so a real reader would make the
 * assertion a race instead of a check.
 */
const withStubFileReader = (content: string, run: () => void): void => {
  const originalFileReader = globalThis.FileReader
  class StubFileReader {
    result: string | null = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsText(): void {
      this.result = content
      this.onload?.()
    }
  }
  globalThis.FileReader = StubFileReader as unknown as typeof FileReader
  try {
    run()
  } finally {
    globalThis.FileReader = originalFileReader
  }
}

/** Picks `content` in the file input, the way the OS file picker would. */
const pickImportFile = (input: HTMLInputElement, content: string): void => {
  const file = new File([content], 'library.json', { type: 'application/json' })
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  withStubFileReader(content, () => { fireEvent.change(input) })
}

describe('live announcements (Plan 157 Phase 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentView = 'home'
    rightPanelOpen = false
    selectedEntityId = null
    editingEntityId = null
  })

  afterEach(() => {
    cleanup()
  })

  it('exposes a polite, atomic live region', async () => {
    const { region } = await renderWithAnnouncer(<Sidebar />)
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
  })

  it('announces a view switch by its human-readable label', async () => {
    const { spoken } = await renderWithAnnouncer(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByText('Library').closest('button')!)
    })

    await waitFor(async () => {
      expect(await spoken()).toBe('Switched to Library')
    })
  })

  it('stays silent when the user re-selects the view they are already on', async () => {
    const { spoken } = await renderWithAnnouncer(<Sidebar />)

    await act(async () => {
      fireEvent.click(screen.getByText('Home').closest('button')!)
    })

    // Re-selecting the current view is not a change; announcing it would make
    // the live region chatter on every stray click.
    expect(await spoken()).toBe('')
  })

  it('announces the density change from the mind map toggle', async () => {
    // The mind map toggle is reachable from the mind map view; render the
    // real view to prove the announcement is wired, not just available.
    const { spoken } = await renderWithAnnouncer(<MindMapView />)
    const toggle = screen.getByTestId('mindmap-compact-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    await act(async () => { fireEvent.click(toggle) })

    await waitFor(async () => {
      expect(await spoken()).toBe('Density set to Compact')
    })
  })

  it('announces the density revert when compact is switched back off', async () => {
    const { spoken } = await renderWithAnnouncer(<MindMapView />)
    const toggle = screen.getByTestId('mindmap-compact-toggle')

    await act(async () => { fireEvent.click(toggle) })
    await waitFor(async () => { expect(await spoken()).toBe('Density set to Compact') })

    await act(async () => { fireEvent.click(toggle) })
    await waitFor(async () => { expect(await spoken()).toBe('Density set to Comfortable') })
  })

  it('announces the deleted entity name from the mind map toolbar', async () => {
    const { spoken } = await renderWithAnnouncer(<MindMapView />)

    await act(async () => {
      const row = screen.getByText('Root Entity').closest<HTMLElement>('[role="treeitem"]')
      row?.focus()
    })
    await act(async () => { fireEvent.click(screen.getByLabelText('Delete')) })

    expect(mockDeleteEntity).toHaveBeenCalledWith('e-root')
    await waitFor(async () => {
      expect(await spoken()).toBe('Deleted Root Entity')
    })
  })

  it('stays silent when Delete is pressed with no node focused', async () => {
    const { spoken } = await renderWithAnnouncer(<MindMapView />)

    await act(async () => { fireEvent.click(screen.getByLabelText('Delete')) })

    expect(mockDeleteEntity).not.toHaveBeenCalled()
    expect(await spoken()).toBe('')
  })

  it('announces the saved entity name from the editor', async () => {
    // The save either navigates away (mentions) or stays put, so the write
    // itself is the only signal a screen reader gets.
    editingEntityId = 'e-root'
    const { spoken } = await renderWithAnnouncer(<EditorView />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Commit changes' }))
    })

    expect(mockCommitEntities).toHaveBeenCalledTimes(1)
    await waitFor(async () => {
      expect(await spoken()).toBe('Saved Root Entity')
    })
  })

  it('announces the deleted entity name from the inspector', async () => {
    // The mind map's own delete is covered above; this is the right-panel
    // inspector path, which deletes whichever entity the panel is showing.
    currentView = 'graph'
    rightPanelOpen = true
    selectedEntityId = 'e-root'
    const { spoken } = await renderWithAnnouncer(<RightPanel />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    // The panel trigger and the confirmation button share the label "Delete",
    // so scope the confirming click to the dialog.
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    })

    expect(mockDeleteEntity).toHaveBeenCalledWith('e-root')
    await waitFor(async () => {
      expect(await spoken()).toBe('Deleted Root Entity')
    })
  })

  it('announces how much the import replaced', async () => {
    mockImportWithRollback.mockReturnValue({ success: true, backupPersisted: true })
    const { spoken, container } = await renderWithAnnouncer(<ExportView />)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('import file input not found')

    pickImportFile(input, importFileContent)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))
    })

    expect(mockImportWithRollback).toHaveBeenCalledTimes(1)
    // An import silently replaces the whole library, so the counts are the only
    // way a screen reader user can confirm the scale of the change.
    await waitFor(async () => {
      expect(await spoken()).toBe('Imported 1 entity and 1 claim')
    })
  })

  it('announces the demo-library reset', async () => {
    const { spoken } = await renderWithAnnouncer(<ExportView />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to demo data' }))
    })
    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reset everything' }))
    })

    expect(mockResetStore).toHaveBeenCalledTimes(1)
    await waitFor(async () => {
      expect(await spoken()).toBe('Restored the demo library')
    })
  })

  it('announces the new view for each distinct navigation', async () => {
    const { spoken } = await renderWithAnnouncer(<Sidebar />)

    for (const label of ['Graph', 'Timeline', 'Editor']) {
      currentView = 'home'
      await act(async () => {
        fireEvent.click(screen.getByText(label).closest('button')!)
      })
      await waitFor(async () => {
        expect(await spoken()).toBe(`Switched to ${label}`)
      })
    }
  })

  it('has no unwired announcement keys', () => {
    // Plan 158 P2-9: four keys were defined but never called, so those
    // mutations were silent for screen-reader users while the code looked
    // complete. Asserting the keys EXIST would not catch that — this asserts
    // the opposite direction: every key has at least one call site.
    // Exclude the message file itself: it is where keys are DEFINED, so
    // including it would make every key look wired.
    const callSites = execSync(
      "grep -rho 'announce\\.[a-zA-Z]*' src --include=*.tsx --include=*.ts " +
        "--exclude=announce.ts || true",
      { encoding: 'utf8' },
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const defined = readFileSync('src/lib/i18n/messages/announce.ts', 'utf8')
      .split('\n')
      .map((line) => line.match(/'(announce\.[a-zA-Z]+)':/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => m[1])

    const unwired = defined.filter((key) => !callSites.includes(key))
    expect(unwired).toEqual([])
  })
})
