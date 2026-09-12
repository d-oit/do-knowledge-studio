import type { LucideIcon } from 'lucide-react'
import { z } from 'zod'
import { ENTITY_TYPE_META, type EntityType } from './types'

/** Visual metadata for an entity type (label + Tailwind token classes). */
export interface EntityTypeMeta {
  label: string
  color: string
  bg: string
  text: string
  dot: string
  icon?: LucideIcon
}

/** A registered entity type definition: metadata plus a stable string id. */
export interface EntityTypeDef extends EntityTypeMeta {
  id: string
}

/**
 * Reserved type ids that are query filter sentinels, never stored entity
 * types — registration rejects them so every registered id is hydratable
 * (mirrors `StoredEntityTypeSchema` in ./schema).
 */
const RESERVED_TYPE_IDS: ReadonlySet<string> = new Set(['all'])

/**
 * A LucideIcon is a forwardRef component: a `$$typeof`-tagged object at
 * runtime (plain functions also accepted for exotic cases). The predicate
 * keeps Zod 4's `z.custom` from accepting arbitrary values like `{}`.
 */
const isReactComponentValue = (value: unknown): boolean =>
  typeof value === 'function' ||
  (typeof value === 'object' &&
    value !== null &&
    typeof (value as { $$typeof?: unknown }).$$typeof === 'symbol')

/**
 * Zod schema for plugin-supplied type definitions. Mirrors the persisted
 * `AnyEntityTypeSchema` constraints (non-blank, ≤ 64 chars) so an id that
 * passes registration is always accepted by hydration validation.
 */
const EntityTypeDefSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .refine((s) => s.trim().length > 0, {
      message: 'Entity type id must be a non-blank string',
    })
    .refine((s) => !RESERVED_TYPE_IDS.has(s), {
      message: `Entity type id cannot be a reserved filter sentinel: ${Array.from(RESERVED_TYPE_IDS).join(', ')}`,
    }),
  label: z.string().min(1).max(64).refine((s) => s.trim().length > 0, {
    message: 'Entity type label must be a non-blank string',
  }),
  color: z.string(),
  bg: z.string(),
  text: z.string(),
  dot: z.string(),
  icon: z.custom<LucideIcon>(isReactComponentValue).optional(),
})

/** Neutral fallback styling for unregistered/unknown type strings. */
const NEUTRAL_META: Omit<EntityTypeMeta, 'label' | 'icon'> = {
  color: 'neutral',
  bg: 'bg-zinc-100 dark:bg-zinc-950/40',
  text: 'text-zinc-700 dark:text-zinc-300',
  dot: 'bg-zinc-400',
}

/**
 * Plugin-registered custom type definitions, keyed by id (insertion order).
 * This module intentionally stays icon-library-agnostic: custom defs MAY
 * carry an optional icon; built-in icons are owned by the renderer
 * (`entity-type-icon.tsx`), which maps builtins and falls back to a neutral
 * icon for everything else.
 */
const customTypeDefs = new Map<string, EntityTypeDef>()

/** Built-in defs derived from {@link ENTITY_TYPE_META} (no icon — see above). */
const builtinTypeDefs: EntityTypeDef[] = (Object.keys(ENTITY_TYPE_META) as EntityType[]).map(
  (id) => ({ id, ...ENTITY_TYPE_META[id] }),
)

/**
 * Registers a custom entity type at runtime. Idempotent by id: registering
 * the same id again replaces the previous definition (single entry, no
 * duplicates). Built-in ids cannot be overridden — the call is rejected with
 * a console.error. Throws if the definition fails the {@link EntityTypeDefSchema}
 * validation (plugin API misuse should fail loudly).
 *
 * @example
 * registerEntityType({
 *   id: 'roadmap',
 *   label: 'Roadmap',
 *   color: 'violet',
 *   bg: 'bg-violet-100 dark:bg-violet-950/40',
 *   text: 'text-violet-700 dark:text-violet-300',
 *   dot: 'bg-violet-500',
 *   icon: Map,
 * })
 */
export const registerEntityType = (def: EntityTypeDef): void => {
  const parsed = EntityTypeDefSchema.safeParse(def)
  if (!parsed.success) {
    throw new TypeError(`Invalid entity type definition: ${parsed.error.message}`)
  }
  const { id } = parsed.data
  if (Object.prototype.hasOwnProperty.call(ENTITY_TYPE_META, id)) {
    console.error(`entity-types: cannot register built-in entity type "${id}"`)
    return
  }
  customTypeDefs.set(id, { ...parsed.data })
}

/** Lists all known type definitions: built-ins (canonical order) then custom
 * registrations. Each def is a fresh shallow copy so callers may mutate the
 * result without corrupting the cached registry. */
export const getEntityTypeDefs = (): EntityTypeDef[] => [
  ...builtinTypeDefs.map((def) => ({ ...def })),
  ...Array.from(customTypeDefs.values()).map((def) => ({ ...def })),
]

/**
 * Resolves visual metadata for any type string, never throwing:
 * custom registry → built-in meta → neutral default (label falls back to the
 * raw type string, so unknown types stay readable).
 */
export const getEntityTypeMeta = (type: string): EntityTypeMeta => {
  const custom = customTypeDefs.get(type)
  if (custom) return custom
  const builtin = Object.prototype.hasOwnProperty.call(ENTITY_TYPE_META, type)
    ? ENTITY_TYPE_META[type as EntityType]
    : undefined
  if (builtin) return builtin
  return { ...NEUTRAL_META, label: type }
}

/** Clears all registered custom types (test helper). */
export const resetCustomEntityTypes = (): void => {
  customTypeDefs.clear()
}