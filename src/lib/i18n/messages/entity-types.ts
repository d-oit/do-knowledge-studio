import { makeT } from '@/lib/i18n/t'

/**
 * Entity-type registry (N7) message scope: type selector labels, the graph
 * legend heading, and the neutral fallback label for unregistered types.
 */
const messages = {
  'entity-types.legendHeading': 'Entity types',
  'entity-types.selectorLabel': (label: string) => `Entity type: ${label}. Change type`,
  'entity-types.typePrefix': (label: string) => `Type: ${label}`,
  'entity-types.listboxLabel': 'Select entity type',
  'entity-types.neutralLabel': 'Item',
} as const

export const translate = makeT(messages)