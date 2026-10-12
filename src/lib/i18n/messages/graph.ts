/**
 * Graph view i18n messages (#870).
 *
 * User-facing strings for the graph view: its hero header and the empty state
 * that offers a way out of the blank canvas. Owned by the view-chrome
 * workstream; new graph strings belong here rather than inline in the view.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Hero header subtitle of the graph view. */
  'graph.subtitle': 'See how your entities connect, and reshape the layout around them.',
  /** Empty state headline when the library holds no entities to draw. */
  'graph.empty.title': 'Nothing to graph yet',
  /** Empty state body explaining how nodes appear on the canvas. */
  'graph.empty.body':
    'Every entity becomes a node here. Create your first one and link it to another to start the map.',
  /** Empty state action that opens a blank entity in the editor. */
  'graph.empty.action': 'Create entity',
} as const

/** Typed `translate` helper bound to the graph message scope. */
export const translate = makeT(messages)
