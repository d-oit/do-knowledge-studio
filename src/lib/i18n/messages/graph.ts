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

  /** Comparison dialog title (Plan 170). */
  'graph.comparison.title': 'Graph Revision Comparison',
  /** Comparison dialog intro naming the snapshot timestamp. */
  'graph.comparison.savedOn': (timestamp: string) => `Comparing live graph against snapshot saved on ${timestamp}.`,
  /** Canvas delta section heading. */
  'graph.comparison.canvasChanges': 'Canvas Changes',
  /** Layout row label. */
  'graph.comparison.layout': 'Layout',
  /** Zoom row label. */
  'graph.comparison.zoom': 'Zoom',
  /** Pan row label. */
  'graph.comparison.pan': 'Pan',
  /** Focus mode row label. */
  'graph.comparison.focusMode': 'Focus mode',
  /** Selection row label. */
  'graph.comparison.selection': 'Selection',
  /** Unchanged value with its current state, e.g. `Unchanged (on)`. */
  'graph.comparison.unchanged': (value: string) => `Unchanged (${value})`,
  /** Plain unchanged value for numeric deltas at rest. */
  'graph.comparison.unchangedPlain': 'Unchanged',
  /** Value shown when nothing is selected. */
  'graph.comparison.none': 'none',
  /** Boolean state labels for the focus mode row. */
  'graph.comparison.on': 'on',
  /** Boolean state labels for the focus mode row. */
  'graph.comparison.off': 'off',
  /** Topology delta section heading. */
  'graph.comparison.entityChanges': 'Entity & Connection Changes',
  /** Retained-entity tally. */
  'graph.comparison.retainedEntities': (count: string) => `${count} retained entities`,
  /** Added-entities group heading. */
  'graph.comparison.addedEntities': (count: string) => `Added Entities (${count})`,
  /** Removed-entities group heading. */
  'graph.comparison.removedEntities': (count: string) => `Removed Entities (${count})`,
  /** Added-connections group heading. */
  'graph.comparison.addedConnections': (count: string) => `Added Connections (${count})`,
  /** Removed-connections group heading. */
  'graph.comparison.removedConnections': (count: string) => `Removed Connections (${count})`,
  /** Directed connection line, e.g. `Alpha -> Beta`. */
  'graph.comparison.connection': (from: string, to: string) => `${from} → ${to}`,
  /** Pan delta value, e.g. `Δx +30.00, Δy -20.00`. */
  'graph.comparison.panDelta': (x: string, y: string) => `Δx ${x}, Δy ${y}`,
  /** Summary when topology matches exactly. */
  'graph.comparison.noTopologyChanges': 'Graph entities and connections are identical to snapshot.',
  /** Fallback when the stored snapshot has no topology payload. */
  'graph.comparison.noTopologyData':
    'Saved snapshot predates topology tracking. Layout and viewport comparison are displayed above.',
  /** Footer dismiss action. */
  'graph.comparison.close': 'Close',
  /** Accessible name of the header dismiss control. */
  'graph.comparison.closeAria': 'Close comparison dialog',
  /** Inbound-link group heading in the right-panel inspector. */
  'graph.inspector.referencedBy': (count: string) => `Referenced by (${count})`,
} as const

/** Typed `translate` helper bound to the graph message scope. */
export const translate = makeT(messages)
