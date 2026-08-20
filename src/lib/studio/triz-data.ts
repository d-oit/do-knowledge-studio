/**
 * TRIZ Contradiction Matrix data.
 *
 * 39 engineering parameters × 40 inventive principles.
 * Matrix is stored as a sparse map: key = "improving-worsening", value = principle IDs.
 * Based on the classic Altshuller contradiction matrix.
 */

import type { TrizPrinciple } from './triz-principles'
import { TRIZ_PRINCIPLES } from './triz-principles'
import { TRIZ_PARAMETERS } from './triz-parameters'
import { TRIZ_MATRIX_1 } from './triz-matrix-1'
import { TRIZ_MATRIX_2 } from './triz-matrix-2'

/** Re-exported TRIZ principle type from sub-module. */
export type { TrizPrinciple }
/** Re-exported TRIZ principles array from sub-module. */
export { TRIZ_PRINCIPLES }
/** Re-exported TRIZ parameters array from sub-module. */
export { TRIZ_PARAMETERS }

/** Sparse contradiction matrix mapping "improving-worsening" keys to principle IDs. */
const TRIZ_MATRIX: Record<string, number[]> = {
  ...TRIZ_MATRIX_1,
  ...TRIZ_MATRIX_2,
}

/** Re-exported merged contradiction matrix. */
export { TRIZ_MATRIX }

/** Pre-indexed map for O(1) principle lookups by ID. */
const PRINCIPLES_BY_ID = new Map(TRIZ_PRINCIPLES.map((p) => [p.id, p]))

/** Look up inventive principles for an improving/worsening parameter pair. */
export function lookupPrinciples(
  improving: number,
  worsening: number,
): typeof TRIZ_PRINCIPLES {
  const key = `${improving}-${worsening}`
  const ids = TRIZ_MATRIX[key] ?? []
  return ids
    .map((id) => PRINCIPLES_BY_ID.get(id))
    .filter((p): p is (typeof TRIZ_PRINCIPLES)[number] => p !== undefined)
}

