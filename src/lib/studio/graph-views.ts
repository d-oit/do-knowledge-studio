/**
 * Saved graph views: a named filter + layout + viewport (#1058).
 *
 * Views are user data, so they live in the store envelope (IndexedDB-backed,
 * validated on every load) rather than in a second localStorage corpus, and
 * they travel in the backup archive's `data/canvas.json`. Every field is
 * schema-validated before it can steer a canvas.
 */
import { z } from 'zod'
import { MAX_ZOOM, MIN_ZOOM } from './graph-gestures'
import { EMPTY_GRAPH_FILTER } from './graph-query'
import { GRAPH_LAYOUTS, type GraphLayout } from './graph-snapshot'

/** Hard cap on saved views so the envelope cannot grow without bound. */
export const MAX_SAVED_GRAPH_VIEWS = 50

/** Longest accepted view name. */
export const GRAPH_VIEW_NAME_MAX_LENGTH = 60

/** Zod schema for a canvas filter. */
export const GraphFilterSchema = z.object({
  types: z.array(z.string()),
  tags: z.array(z.string()),
  relations: z.array(z.string()),
  verifiedOnly: z.boolean(),
  minConfidence: z.number().min(0).max(1),
  updatedAfter: z.string().nullable(),
  updatedBefore: z.string().nullable(),
})

/** Zod schema for the viewport transform a view restores. */
export const GraphViewportSchema = z.object({
  panX: z.number().finite(),
  panY: z.number().finite(),
  zoom: z.number().finite().min(MIN_ZOOM).max(MAX_ZOOM),
})

/** Zod schema for one saved view. */
export const SavedGraphViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(GRAPH_VIEW_NAME_MAX_LENGTH),
  filter: GraphFilterSchema,
  layout: z.enum(GRAPH_LAYOUTS),
  focusMode: z.boolean(),
  viewport: GraphViewportSchema,
  createdAt: z.string().min(1),
})

/** Array schema for the persisted envelope and backup payload. */
export const SavedGraphViewsSchema = z.array(SavedGraphViewSchema).max(MAX_SAVED_GRAPH_VIEWS)

/** A saved, named canvas view. */
export type SavedGraphView = z.infer<typeof SavedGraphViewSchema>

/** Everything a caller supplies to save a view; id and timestamp are derived. */
export type SavedGraphViewInput = Omit<SavedGraphView, 'id' | 'createdAt'>

/** Normalizes a user-typed view name: trimmed and length-capped. */
export const normalizeGraphViewName = (name: string): string =>
  name.trim().slice(0, GRAPH_VIEW_NAME_MAX_LENGTH)

/**
 * Builds a saved view with a fresh id and timestamp.
 * @param input - Filter, layout, focus mode, and viewport to store.
 * @param options - Id and timestamp overrides (used by import/restore paths).
 * @returns The saved view.
 */
export const buildSavedGraphView = (
  input: SavedGraphViewInput,
  options?: { id?: string; createdAt?: string },
): SavedGraphView => ({
  id: options?.id ?? crypto.randomUUID(),
  createdAt: options?.createdAt ?? new Date().toISOString(),
  name: normalizeGraphViewName(input.name),
  filter: input.filter,
  layout: input.layout,
  focusMode: input.focusMode,
  viewport: input.viewport,
})

/**
 * Inserts or replaces a view (by id) and keeps the newest first, capped.
 * @param views - Current saved views.
 * @param view - View to store.
 * @returns The new list; never longer than {@link MAX_SAVED_GRAPH_VIEWS}.
 */
export const upsertSavedGraphView = (
  views: SavedGraphView[],
  view: SavedGraphView,
): SavedGraphView[] => [view, ...views.filter((existing) => existing.id !== view.id)].slice(
  0,
  MAX_SAVED_GRAPH_VIEWS,
)

/** Removes a saved view by id. */
export const removeSavedGraphView = (views: SavedGraphView[], id: string): SavedGraphView[] =>
  views.filter((view) => view.id !== id)

/** Default filter stored by the view builder when no facets are chosen. */
export const EMPTY_SAVED_VIEW_FILTER = EMPTY_GRAPH_FILTER

/** Layout a saved view falls back to when its filter is empty. */
export const DEFAULT_SAVED_VIEW_LAYOUT: GraphLayout = 'force'
