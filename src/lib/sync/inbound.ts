import { EntitySchema, ClaimSchema, type ValidationError } from '@/lib/studio/schema'
import type { Entity, Claim } from '@/lib/studio/types'

export type InboundResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }

export function validateInboundEntity(data: unknown): InboundResult<Entity> {
  const result = EntitySchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

export function validateInboundClaim(data: unknown): InboundResult<Claim> {
  const result = ClaimSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

export function validateInboundEntities(items: unknown[]): {
  valid: Entity[]
  rejected: { index: number; errors: ValidationError[] }[]
} {
  const valid: Entity[] = []
  const rejected: { index: number; errors: ValidationError[] }[] = []
  for (let i = 0; i < items.length; i++) {
    const result = validateInboundEntity(items[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      rejected.push({ index: i, errors: result.errors })
    }
  }
  return { valid, rejected }
}

export function validateInboundClaims(items: unknown[]): {
  valid: Claim[]
  rejected: { index: number; errors: ValidationError[] }[]
} {
  const valid: Claim[] = []
  const rejected: { index: number; errors: ValidationError[] }[] = []
  for (let i = 0; i < items.length; i++) {
    const result = validateInboundClaim(items[i])
    if (result.success) {
      valid.push(result.data)
    } else {
      rejected.push({ index: i, errors: result.errors })
    }
  }
  return { valid, rejected }
}
