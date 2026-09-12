/**
 * Shortcuts dialog i18n messages (N5).
 *
 * User-facing strings for `shortcuts-dialog.tsx`: dialog chrome, the
 * shortcut table (groups and action labels — key labels stay as-is), the
 * filter, and the G-key tip. Action labels are looked up at module scope,
 * so the table stays a plain const.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Accessible name of the shortcuts dialog. */
  'shortcuts.ariaLabel': 'Keyboard shortcuts',
  /** Dialog heading. */
  'shortcuts.title': 'Keyboard shortcuts',
  /** Close button label. */
  'shortcuts.close': 'Close shortcuts dialog',
  /** Filter input placeholder. */
  'shortcuts.filterPlaceholder': 'Filter shortcuts...',
  /** Accessible label of the filter input. */
  'shortcuts.filterAriaLabel': 'Filter shortcuts',
  /** Clear-filter button label. */
  'shortcuts.clearFilter': 'Clear filter search',
  /** Empty results state; filter text interpolated. */
  'shortcuts.noMatch': (filter: string) => `No shortcuts match "${filter}"`,
  /** Tip text before the G key label. */
  'shortcuts.tipPrefix': 'Tip: the ',
  /** Tip text after the G key label. */
  'shortcuts.tipSuffix':
    ' sequence waits 1 second for the next key — if you change your mind, just wait or press any other key to cancel.',
  /** G-pending indicator text. */
  'shortcuts.gIndicator': 'Press a key…',
  /** Trigger button accessible label. */
  'shortcuts.triggerAria': 'Show keyboard shortcuts',
  /** Trigger button tooltip. */
  'shortcuts.triggerTitle': 'Keyboard shortcuts (?)',
  /** Trigger button label. */
  'shortcuts.triggerLabel': 'Shortcuts',

  /** Group heading: global shortcuts. */
  'shortcuts.group.global': 'Global',
  /** Group heading: G-key navigation. */
  'shortcuts.group.navigate': 'Navigate (press G, then a letter)',
  /** Group heading: editor shortcuts. */
  'shortcuts.group.editor': 'Editor',
  /** Group heading: library shortcuts. */
  'shortcuts.group.library': 'Library',

  /** Action: open the command palette. */
  'shortcuts.action.openPalette': 'Open command palette',
  /** Action: show this help. */
  'shortcuts.action.showHelp': 'Show this help',
  /** Action: close the topmost overlay. */
  'shortcuts.action.closeOverlay': 'Close dialog / palette / drawer',
  /** Action: go to the home view. */
  'shortcuts.action.goHome': 'Go to Home',
  /** Action: go to the editor view. */
  'shortcuts.action.goEditor': 'Go to Editor',
  /** Action: go to the library view. */
  'shortcuts.action.goLibrary': 'Go to Library',
  /** Action: go to the graph view. */
  'shortcuts.action.goGraph': 'Go to Graph',
  /** Action: go to the mind map view. */
  'shortcuts.action.goMindMap': 'Go to Mind Map',
  /** Action: go to the chat view. */
  'shortcuts.action.goChat': 'Go to Chat',
  /** Action: go to the AI harness view. */
  'shortcuts.action.goAi': 'Go to AI Harness',
  /** Action: go to the TRIZ matrix view. */
  'shortcuts.action.goTriz': 'Go to TRIZ Matrix',
  /** Action: go to the export view. */
  'shortcuts.action.goExport': 'Go to Export',
  /** Action: go to the sync view. */
  'shortcuts.action.goSync': 'Go to Sync',
  /** Action: bold. */
  'shortcuts.action.bold': 'Bold',
  /** Action: italic. */
  'shortcuts.action.italic': 'Italic',
  /** Action: underline. */
  'shortcuts.action.underline': 'Underline',
  /** Action: strikethrough. */
  'shortcuts.action.strikethrough': 'Strikethrough',
  /** Action: highlight. */
  'shortcuts.action.highlight': 'Highlight',
  /** Action: code block. */
  'shortcuts.action.codeBlock': 'Code block',
  /** Action: focus search. */
  'shortcuts.action.focusSearch': 'Focus search',
  /** Action: new entity. */
  'shortcuts.action.newEntity': 'New entity',
} as const

/** Typed `translate` helper bound to the shortcuts dialog message scope. */
export const translate = makeT(messages)