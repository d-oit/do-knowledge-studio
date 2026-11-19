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
  /** Visual query builder (#1164) heading. */
  'graph.builder.heading': 'Visual query builder',
  /** Label for the root operator selector. */
  'graph.builder.match': 'Match',
  /** Operator option: all conditions must match. */
  'graph.builder.and': 'AND',
  /** Operator option: any condition may match. */
  'graph.builder.or': 'OR',
  /** Adds a leaf condition to a group. */
  'graph.builder.addCondition': 'Add condition',
  /** Adds a nested group to a group. */
  'graph.builder.addGroup': 'Add group',
  /** Negates a clause inside its group. */
  'graph.builder.exclude': 'Exclude',
  /** Accessible label on a clause's remove control. */
  'graph.builder.removeAria': (label: string) => `Remove ${label}`,
  /** Group kind label used in remove/announcements. */
  'graph.builder.group': 'Group',
  /** Accessible name for a clause list, distinguishing it from validation lists. */
  'graph.builder.list.conditions': 'Conditions',
  /** Condition kind label used in remove/announcements. */
  'graph.builder.condition': 'Condition',
  /** Condition-kind option labels. */
  'graph.builder.kind.entityType': 'Entity type',
  'graph.builder.kind.tag': 'Tag',
  'graph.builder.kind.text': 'Text',
  'graph.builder.kind.claimStatus': 'Claim status',
  'graph.builder.kind.minConfidence': 'Min confidence',
  /** Accessible labels for condition value controls. */
  'graph.builder.value.entityType': 'Entity type value',
  'graph.builder.value.tag': 'Tag value',
  'graph.builder.value.text': 'Text to search',
  'graph.builder.value.claimStatus': 'Claim verification',
  'graph.builder.value.minConfidence': (percent: string) =>
    `Minimum claim confidence: ${percent}%`,
  /** Readable summary of the active query. */
  'graph.builder.summary.empty': 'No conditions — every entity matches.',
  'graph.builder.summary.query': (summary: string) => `Query: ${summary}`,
  /** Live preview count, matching the canvas renderer. */
  'graph.builder.preview': (entities: string, total: string, edges: string) =>
    `${entities} of ${total} entities and ${edges} edges match.`,
  /** Shown while the query is invalid and therefore not applied. */
  'graph.builder.preview.invalid': 'This query has issues and is not applied to the canvas.',
  /** Validation issue group heading. */
  'graph.builder.errors.title': (count: string) => `${count} issue(s) with this query`,
  /** Validation message: blank condition value. */
  'graph.builder.error.blankValue': 'Condition value cannot be empty.',
  /** Validation message: value exceeds the length bound. */
  'graph.builder.error.tooLong': (max: string) => `Value must be at most ${max} characters.`,
  /** Validation message: empty nested group. */
  'graph.builder.error.emptyGroup': 'An empty group matches nothing. Add a condition or remove it.',
  /** Validation message: nesting depth exceeded. */
  'graph.builder.error.depth': (max: string) => `Queries can nest at most ${max} groups deep.`,
  /** Validation message: clause count exceeded. */
  'graph.builder.error.clauseCount': (max: string) =>
    `A query can hold at most ${max} clauses.`,
  /** Validation message: root exclusion. */
  'graph.builder.error.rootExclude': 'The root group cannot be excluded.',
  /** Validation message: confidence out of range. */
  'graph.builder.error.confidenceRange': 'Confidence must be between 0 and 1.',
  /** Renames a saved view. */
  'graph.queries.views.rename': 'Rename',
  /** Duplicates a saved view. */
  'graph.queries.views.duplicate': 'Duplicate',
  /** Accessible name of a view's rename control. */
  'graph.queries.views.renameAria': (name: string) => `Rename saved view ${name}`,
  /** Accessible name of a view's duplicate control. */
  'graph.queries.views.duplicateAria': (name: string) => `Duplicate saved view ${name}`,
  /** Confirms an inline rename. */
  'graph.queries.views.renameConfirm': 'Save name',
  /** Cancels an inline rename. */
  'graph.queries.views.renameCancel': 'Cancel rename',
  /** Default name for a duplicated view. */
  'graph.queries.views.duplicateName': (name: string) => `Copy of ${name}`,

  /** Empty saved-view list message. */
  'graph.queries.views.empty': 'No saved views yet.',
  /** Stored-view cap hint. */
  'graph.queries.views.limit': (max: string) => `Up to ${max} saved views.`,
  /** Accessible name for a view's delete control. */
  'graph.queries.views.deleteAria': (name: string) => `Delete saved view ${name}`,

  /** Notice shown while the canvas draws only part of a large graph (#1053). */
  'graph.scale.partial': (shown: string, total: string) =>
    `Showing ${shown} of ${total} nodes at this zoom. Zoom out or narrow the graph to see the rest.`,
  /** Notice shown while a large graph is still being placed. */
  'graph.scale.placing': (placed: string, total: string) =>
    `Placing nodes: ${placed} of ${total}. The canvas stays interactive.`,
} as const

/** Typed `translate` helper bound to the graph message scope. */
export const translate = makeT(messages)
