/**
 * TRIZ matrix i18n messages (N5).
 *
 * User-facing strings for the TRIZ views: branding, view toggles, parameter
 * pickers, results, and the contradiction matrix table. `triz-helpers.tsx`
 * (ParamPicker search input) keeps its own strings owned elsewhere.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Toast when a principle is copied. */
  'triz.toast.copied': 'Principle copied to clipboard',
  /** TRIZ branding heading. */
  'triz.branding.title': 'TRIZ Contradiction Matrix',
  /** Lab badge next to the branding heading. */
  'triz.branding.lab': 'Lab',
  /** TRIZ branding subtitle. */
  'triz.branding.subtitle':
    'Pick an improving parameter and a worsening parameter — the matrix suggests inventive principles.',
  /** Accessible name of the view toggle group. */
  'triz.viewAriaLabel': 'View',
  /** View toggle: pick. */
  'triz.view.pick': 'Pick',
  /** View toggle: matrix. */
  'triz.view.matrix': 'Matrix',
  /** View toggle: results; count interpolated. */
  'triz.view.results': (count: string) => `Results (${count})`,
  /** Header reset action. */
  'triz.reset': 'Reset',

  /** Improving parameter picker title. */
  'triz.pick.improvingTitle': 'Improving parameter',
  /** Improving parameter picker subtitle. */
  'triz.pick.improvingSubtitle': 'What you want to make better',
  /** Worsening parameter picker title. */
  'triz.pick.worseningTitle': 'Worsening parameter',
  /** Worsening parameter picker subtitle. */
  'triz.pick.worseningSubtitle': 'What gets worse as a result',

  /** Copy-principle button accessible label. */
  'triz.results.copyAria': 'Copy principle',
  /** Examples section label. */
  'triz.results.examples': 'Examples',
  /** Contradiction summary label. */
  'triz.results.summaryLabel': 'Your contradiction',
  /** Summary lead-in before the improving parameter name. */
  'triz.results.summaryPrefix': 'You want to improve ',
  /** Summary separator before the worsening parameter name. */
  'triz.results.summaryMiddle': ', but doing so worsens ',
  /** Summary period after the worsening parameter name. */
  'triz.results.summarySuffix': '.',
  /** Summary suffix when principles were found. */
  'triz.results.summarySuggestions': ' TRIZ suggests these inventive principles:',
  /** Summary suffix when no principles were found for the pair. */
  'triz.results.summaryNone':
    ' No principles found for this pair in the matrix. Try a different combination.',
  /** Suggested principles heading. */
  'triz.results.title': 'Suggested inventive principles',
  /** Action to start a new contradiction. */
  'triz.results.tryAnother': 'Try another contradiction',
  /** Action to change the selected parameters. */
  'triz.results.changeParams': 'Change parameters',

  /** Matrix cell accessible label; row and column names interpolated. */
  'triz.matrix.cellAria': (row: string, col: string) =>
    `Principles for improving ${row} while worsening ${col}`,
  /** Screen-reader caption for the matrix table. */
  'triz.matrix.caption': 'TRIZ Contradiction Matrix',
  /** Column header explaining the axis directions. */
  'triz.matrix.header': '↓ Improving → Worsening',
  /** Matrix panel heading. */
  'triz.matrix.title': 'Contradiction Matrix',
  /** Matrix dimensions; parameter and principle counts interpolated. */
  'triz.matrix.dimensions': (parameters: string, principles: string) =>
    `${parameters} parameters × ${principles} principles`,
  /** Matrix interaction hint. */
  'triz.matrix.hint':
    'Click any cell to see the recommended inventive principles. Highlighted rows/columns show your current selection.',
  /** Matrix filter input placeholder. */
  'triz.matrix.filterPlaceholder': 'Filter parameters…',
  /** Matrix filter input accessible label. */
  'triz.matrix.filterAria': 'Filter TRIZ contradiction matrix parameters',
} as const

/** Typed `translate` helper bound to the TRIZ message scope. */
export const translate = makeT(messages)