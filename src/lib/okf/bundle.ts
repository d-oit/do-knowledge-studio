/**
 * OKF v0.2 bundle serialization — thin facade over the shared `dks-core`
 * engine.
 *
 * The serializer (slugging, type mapping, source building, frontmatter via
 * `yaml`, index/log rendering, related-link rewriting) lives once in
 * `packages/dks-core/src/okf-export.ts` — ported verbatim from this module —
 * and is shared with the `dks` CLI and MCP adapter. This file keeps the
 * historical module path and public API for the PWA.
 */

import { buildOkfBundle as coreBuildOkfBundle } from 'dks-core/okf-export'
import { slug as coreSlug } from 'dks-core/markdown'
import type { Entity, Claim, GraphEdge } from '@/lib/studio/types'
import type { OkfBundle } from './types'

/**
 * Slugs a concept name into a safe, lowercase, kebab-case file name.
 * @param s - The concept name to slugify.
 * @returns The slug, or `'untitled'` when the input has no slugifiable chars.
 */
export const slug = coreSlug

/**
 * Builds an OKF v0.2 bundle from studio state: index.md, log.md, and one
 * concept file per entity, with cross-entity edges rendered as related links.
 * @param entities - Entities to export as concept files.
 * @param claims - Claims attributed to entities.
 * @param edges - Graph edges rendered as related links.
 * @param studioVersion - Producer version recorded in generated metadata.
 * @param now - Timestamp for generated/log metadata.
 * @returns The assembled OKF bundle.
 */
export const buildOkfBundle = (
  entities: Entity[],
  claims: Claim[],
  edges: GraphEdge[],
  studioVersion: string,
  now: Date = new Date(),
): OkfBundle => coreBuildOkfBundle(entities, claims, edges, studioVersion, now)

export type { OkfBundle, OkfBundleFile } from './types'
