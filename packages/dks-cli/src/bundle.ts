/**
 * Bundle resolution and structural adapters between dks-core's domain
 * shapes and the CLI's retrieval/graph inputs. All disk access goes
 * through the `FsPort` (see fs-port.ts) — never `node:fs` directly.
 */

import {
  loadBundleFromDisk,
  parseIndexVersion,
  type BundleConcept,
  type FsPort,
  type LoadedBundle,
  type PwaClaimLike,
  type PwaEntityLike,
  type PwaGraphEntityLike,
} from 'dks-core'
import { CliError, errorText } from './errors.js'
import { decodeUtf8Strict, validateBundlePath } from './fs-port.js'

/** Fallback when neither the flag nor the environment provides a bundle. */
export const DEFAULT_BUNDLE_PATH = './knowledge'
/** Environment override for the default bundle path (#1171). */
export const BUNDLE_ENV_VAR = 'DKS_BUNDLE'
/** Reserved index doc of an OKF bundle. */
const INDEX_FILE_NAME = 'index.md'
/** Separator for synthetic claim ids in query results. */
const CLAIM_ID_SEPARATOR = '#claim-'
/** Relation label used when exporting bundle relations to the graph port. */
const RELATED_RELATION = 'related'

/** Environment lookup surface (Map-backed; prototype-free reads). */
export type EnvLike = ReadonlyMap<string, string>

/**
 * Resolves the bundle path for a run: explicit flag → `DKS_BUNDLE` → the
 * documented default. Every result passes argv-path validation.
 */
export const resolveBundlePath = (flagValue: string | undefined, env: EnvLike): string =>
  validateBundlePath(flagValue ?? env.get(BUNDLE_ENV_VAR) ?? DEFAULT_BUNDLE_PATH)

/** Detail recorded on every command that needs the corpus. */
export const BUNDLE_HINT =
  'pass --bundle <path> (or set DKS_BUNDLE) pointing at an OKF bundle directory or .zip archive'

/** Loads a bundle through the port; parse/size/safety failures become `io`. */
export const loadBundle = (port: FsPort, bundlePath: string): LoadedBundle => {
  try {
    return loadBundleFromDisk(port, bundlePath)
  } catch (err) {
    throw new CliError('io', `bundle "${bundlePath}" could not be loaded: ${errorText(err)}`, BUNDLE_HINT)
  }
}

/**
 * Best-effort read of the declared `okf_version` from a directory bundle's
 * root `index.md`; null when absent or kept inside a zip archive.
 */
export const readRootIndexVersion = (port: FsPort, bundlePath: string): string | null => {
  const root = bundlePath.replace(/\/+$/, '')
  try {
    const text = decodeUtf8Strict(port.readFileBytes(`${root}/${INDEX_FILE_NAME}`))
    return parseIndexVersion(text)
  } catch {
    return null
  }
}

/** Concepts as search-entity documents. */
export const bundleEntities = (bundle: LoadedBundle): PwaEntityLike[] =>
  bundle.concepts.map((concept) => ({
    id: concept.id,
    name: concept.name,
    type: concept.type,
    description: concept.description,
    content: concept.content,
    tags: concept.tags,
  }))

/**
 * Claims as search-claim documents. Claim ids are synthesized
 * (`<entityId>#claim-<1-based position>`) because bundle claims have no
 * persisted id; positions are stable within a loaded bundle.
 */
export const bundleClaims = (bundle: LoadedBundle): PwaClaimLike[] => {
  const claims: PwaClaimLike[] = []
  for (const concept of bundle.concepts) {
    concept.claims.forEach((claim, position) => {
      const claimLike: PwaClaimLike = {
        id: `${concept.id}${CLAIM_ID_SEPARATOR}${position + 1}`,
        entityId: concept.id,
        statement: claim.statement,
      }
      if (claim.source !== undefined) claimLike.source = claim.source
      if (claim.evidence !== undefined) claimLike.evidence = claim.evidence
      claims.push(claimLike)
    })
  }
  return claims
}

/** Concepts as undirected graph nodes with `related` links. */
export const graphEntities = (bundle: LoadedBundle): PwaGraphEntityLike[] =>
  bundle.concepts.map((concept) => ({
    id: concept.id,
    name: concept.name,
    links: concept.relatedIds.map((targetId) => ({ targetId, relation: RELATED_RELATION })),
  }))

/** id → display name for a bundle (single lookup source). */
export const conceptNameById = (bundle: LoadedBundle): ReadonlyMap<string, string> =>
  new Map(bundle.concepts.map((concept) => [concept.id, concept.name] as const))

/** Resolves one concept or throws the not-found failure for the command. */
export const conceptById = (bundle: LoadedBundle, id: string): BundleConcept => {
  const found = bundle.concepts.find((concept) => concept.id === id)
  if (found === undefined) {
    throw new CliError('entity_not_found', `unknown entity id "${id}"`, 'run "dks index" to list bundle entity ids')
  }
  return found
}
