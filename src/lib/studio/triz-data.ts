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

export type { TrizPrinciple }
export { TRIZ_PRINCIPLES }
export { TRIZ_PARAMETERS }

const TRIZ_MATRIX: Record<string, number[]> = {
  ...TRIZ_MATRIX_1,
  ...TRIZ_MATRIX_2,
}

export { TRIZ_MATRIX }

export function lookupPrinciples(
  improving: number,
  worsening: number,
): typeof TRIZ_PRINCIPLES {
  const key = `${improving}-${worsening}`
  const ids = TRIZ_MATRIX[key] ?? []
  return ids
    .map((id) => TRIZ_PRINCIPLES.find((p) => p.id === id))
    .filter((p): p is (typeof TRIZ_PRINCIPLES)[number] => p !== undefined)
}

