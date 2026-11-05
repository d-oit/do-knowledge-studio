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

  /** Toolbar label for the query and saved-view controls (#1058). */
  'graph.queries.toggle': 'Queries',
  /** Toolbar help for the query controls. */
  'graph.queries.toggleHelp':
    'Filter the canvas, trace a path between two entities, and save named views',
  /** Query panel heading. */
  'graph.queries.heading': 'Graph queries',
  /** Filter group legend. */
  'graph.queries.filters.legend': 'Filters',
  /** Entity-type checkbox group legend. */
  'graph.queries.filters.types': 'Entity types',
  /** Tag filter field label. */
  'graph.queries.filters.tags': 'Tags (comma separated)',
  /** Relation filter field label. */
  'graph.queries.filters.relations': 'Relations (comma separated)',
  /** Verified-claims-only checkbox label. */
  'graph.queries.filters.verifiedOnly': 'Verified claims only',
  /** Minimum claim confidence slider label, with the current percentage. */
  'graph.queries.filters.minConfidence': (percent: string) =>
    `Minimum claim confidence: ${percent}%`,
  /** Lower date bound label. */
  'graph.queries.filters.updatedAfter': 'Updated on or after',
  /** Upper date bound label. */
  'graph.queries.filters.updatedBefore': 'Updated on or before',
  /** Clears every filter facet. */
  'graph.queries.filters.clear': 'Clear filters',
  /** Count of active filter facets. */
  'graph.queries.filters.active': (count: string) => `${count} active filter(s)`,
  /** Shown when no facet narrows the canvas. */
  'graph.queries.filters.none': 'No filters applied',
  /** Corpus size summary under the filter controls. */
  'graph.queries.filters.counts': (entities: string, claims: string) =>
    `${entities} entities, ${claims} claims in scope.`,
  /** Path group legend. */
  'graph.queries.path.legend': 'Shortest path',
  /** Path start selector label. */
  'graph.queries.path.from': 'From',
  /** Path target selector label. */
  'graph.queries.path.to': 'To',
  /** Runs the path query. */
  'graph.queries.path.find': 'Find path',
  /** Clears the current path result. */
  'graph.queries.path.clear': 'Clear path',
  /** Prompt shown before a path is queried. */
  'graph.queries.path.missing': 'Choose two entities to trace a path.',
  /** Result when the entities are not connected. */
  'graph.queries.path.noPath': 'No path connects those entities.',
  /** Result when a selected entity no longer exists. */
  'graph.queries.path.unknown': 'One of those entities no longer exists.',
  /** Summary line with the hop count. */
  'graph.queries.path.summary': (hops: string) => `${hops} hop(s) in the shortest path`,
  /** One hop line, e.g. `1. cites`. */
  'graph.queries.path.hop': (index: string, relation: string) => `${index}. ${relation}`,
  /** Saved-views group legend. */
  'graph.queries.views.legend': 'Saved views',
  /** View name field label. */
  'graph.queries.views.name': 'View name',
  /** Saves the current filter, layout, and viewport. */
  'graph.queries.views.save': 'Save view',
  /** Applies a saved view. */
  'graph.queries.views.apply': 'Apply',
  /** Empty saved-view list message. */
  'graph.queries.views.empty': 'No saved views yet.',
  /** Stored-view cap hint. */
  'graph.queries.views.limit': (max: string) => `Up to ${max} saved views.`,
  /** Accessible name for a view's delete control. */
  'graph.queries.views.deleteAria': (name: string) => `Delete saved view ${name}`,
} as const

/** Typed `translate` helper bound to the graph message scope. */
export const translate = makeT(messages)
