import { z } from 'zod'

/** OKF actor convention (§7): `human:<id>` | `process:<id>` | `<producer>/<version>`. */
export const OkfActorSchema = z
  .string()
  .regex(/^(human:|process:|[\w.-]+\/).+$/, 'invalid OKF actor')

/** ISO `YYYY-MM-DD` date used by OKF lifecycle fields. */
export const OkfIsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** §5.1 source entry: the provenance record a concept cites via footnote labels. */
export const OkfSourceSchema = z.object({
  id: z.string().optional(), // stable join key for footnote attribution (§5.1)
  resource: z.string().min(1), // REQUIRED within an entry (§5.1)
  title: z.string().optional(),
  author: OkfActorSchema.optional(),
  usage_count: z.number().int().nonnegative().optional(),
  last_modified: OkfIsoDateSchema.optional(),
  usage_window: z.object({ from: OkfIsoDateSchema, to: OkfIsoDateSchema }).optional(),
})

/** §5.2 actor event: who did something and when (used by generated/verified). */
export const OkfActorEventSchema = z.object({
  by: OkfActorSchema, // REQUIRED within generated/verified (§5.2)
  at: z.string().datetime({ offset: true }).optional(),
})

/** §5.4 lifecycle status values for a concept. */
export const OkfStatusSchema = z.enum(['draft', 'stable', 'deprecated'])

/** Frontmatter shared by every OKF concept (§4.1 + §5). */
export const OkfConceptFrontmatterSchema = z
  .object({
    /** Entity type. */
    type: z.string().min(1), // the ONLY always-required key (§4.1)
    /** Human-readable title or evidence label. */
    title: z.string().optional(),
    /** One-line summary of the item. */
    description: z.string().optional(),
    /** The resource. */
    resource: z.string().optional(),
    /** Optional tags payload carried through the operation. */
    tags: z.array(z.string()).optional(),
    /** Provenance source entries for the concept. */
    sources: z.array(OkfSourceSchema).optional(),
    /** The usage_window. */
    usage_window: z.object({ from: OkfIsoDateSchema, to: OkfIsoDateSchema }).optional(),
    /** The generated. */
    generated: OkfActorEventSchema.optional(),
    // §5.2: a bare mapping MUST be accepted as a one-element list
    /** The verified. */
    verified: z.union([OkfActorEventSchema, z.array(OkfActorEventSchema)]).optional(),
    /** The status. */
    status: OkfStatusSchema.optional(),
    /** The stale_after. */
    stale_after: OkfIsoDateSchema.optional(),
  })
  .passthrough() // §4.1 extensions: consumers MUST preserve unknown keys

/** Attested Computation contract (§10.2). */
export const OkfAttestedComputationSchema = OkfConceptFrontmatterSchema.extend({
  type: z.literal('Attested Computation'),
  runtime: z.string().min(1), // REQUIRED for this type (§10.2)
  parameters: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean().default(false),
      }),
    )
    .optional(),
  computation: z.string().optional(), // path (§6.2); absent ⇒ body "# Computation" fence
  executor: z.object({ resource: z.string(), receipt: z.array(z.string()) }).optional(),
  attester: z.object({ resource: z.string() }).optional(),
})

/** One file inside an OKF bundle: a bundle-relative path plus its Markdown content. */
export interface OkfBundleFile {
  /** Bundle-relative file path. */
  path: string // bundle-relative, e.g. "concepts/foo.md"
  /** Markdown or text content. */
  content: string
}

/** An OKF v0.2 bundle: a flat collection of files plus the format version. */
export interface OkfBundle {
  /** Bundle files (path → content). */
  files: OkfBundleFile[]
  /** OKF bundle format version. */
  okfVersion: '0.2'
}