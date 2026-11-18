/**
 * Shared domain types and safety limits for the framework-neutral core.
 * These types are the single contract between the `dks` CLI and the
 * optional MCP adapter; neither layer re-implements parsing or indexing.
 */

/** Largest accepted bundle zip (mirrors the vault-zip compressed cap). */
export const MAX_BUNDLE_ZIP_BYTES = 10_485_760
/** Largest accepted decompressed total (mirrors the vault-zip safety cap). */
export const MAX_BUNDLE_UNCOMPRESSED_BYTES = 52_428_800
/** Largest accepted entry count (mirrors the vault-zip entry cap). */
export const MAX_BUNDLE_ENTRIES = 2_000
/** Largest accepted single concept file (fail-closed before parsing). */
export const MAX_CONCEPT_BYTES = 5_242_880
/** Zip prefix used by the studio OKF export; stripped to bundle paths. */
export const EXPORT_PREFIX = 'okf-bundle/'
/** OKF bundle format versions this core understands. */
export const SUPPORTED_OKF_MAJOR = '0.2'

/** Provenance source entry from concept frontmatter. */
export interface BundleSource {
  /** Stable join key for `[^id]` footnote attribution. */
  id?: string
  /** REQUIRED within an entry: the cited resource. */
  resource: string
  /** Human-readable title or evidence label. */
  title?: string
  /** Actor convention `human:<id>` | `process:<id>` | `<producer>/<version>`. */
  author?: string
}

/** Actor event from concept frontmatter (`generated` / `verified`). */
export interface BundleActorEvent {
  by: string
  at?: string
}

/** Trust tier derived from frontmatter `verified` (mirrors trustTier). */
export type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed'

/** A claim recovered from a concept's `# Claims` list. */
export interface BundleClaim {
  /** The claim statement text. */
  statement: string
  /** Derived from the concept's trust tier, never upgraded. */
  verification: 'verified' | 'unverified'
  /** Source resource joined through the footnote label, when present. */
  source?: string
  /** Source title joined through the footnote label, when present. */
  evidence?: string
}

/** A parsed bundle concept. */
export interface BundleConcept {
  /** Concept id: bundle-relative path minus `.md`. */
  id: string
  /** Human-readable title or evidence label. */
  name: string
  /** OKF concept type string (e.g. `Note`, `Concept`). */
  type: string
  /** One-line summary of the item. */
  description: string
  /** Markdown body without the `# Claims` / `# Related` sections. */
  content: string
  /** Optional tags payload. */
  tags: string[]
  /** Optional aliases (Markdown frontmatter `aliases`). */
  aliases?: string[]
  /** Concept trust tier from frontmatter `verified`. */
  trustTier: TrustTier
  /** Provenance source entries. */
  sources: BundleSource[]
  /** Claims recovered from the `# Claims` list. */
  claims: BundleClaim[]
  /** Related-concept links (`# Related` section): target bundle ids. */
  relatedIds: string[]
}

/** A loaded bundle: concepts plus non-fatal warnings. */
export interface LoadedBundle {
  /** Parsed concepts in bundle order. */
  concepts: BundleConcept[]
  /** Non-fatal notes (skipped entries, unknown keys are tolerated). */
  warnings: string[]
}

/** A minimal entity shape (id, name, type, description, content, tags, aliases). */
export interface CoreEntity {
  id: string
  name: string
  type: string
  description: string
  content: string
  tags: string[]
  aliases?: string[]
  /** Outgoing typed relations. */
  links?: Array<{ targetId: string; relation: string }>
}

/** A minimal claim shape used by export/backup services. */
export interface CoreClaim {
  id: string
  entityId: string
  statement: string
  verification: 'verified' | 'unverified' | 'disputed'
  source?: string
  evidence?: string
}
