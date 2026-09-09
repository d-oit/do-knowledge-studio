import { makeT } from '@/lib/i18n/t'

/**
 * Timeline view (N2) message scope.
 *
 * Format strings for date bands live here too so locale-sensitive
 * formatting is configured in one place (AGENTS.md: no hardcoded
 * user-facing strings).
 */
const messages = {
  'timeline.nav.label': 'Timeline',
  'timeline.title': 'Timeline',
  'timeline.subtitle': 'Entities and claims grouped by when they were created.',
  'timeline.monthFormat': 'MMMM yyyy',
  'timeline.dayFormat': 'EEEE, MMMM d',
  'timeline.timeFormat': 'h:mm a',
  'timeline.itemCount': (n: string) => `${n} items`,
  'timeline.openItem': (label: string) => `Open ${label} in editor`,
  'timeline.claimBadge': 'Claim',
  'timeline.empty.title': 'Nothing here yet',
  'timeline.empty.body': 'Entities and claims you create will appear here, grouped by day.',
  'timeline.empty.action': 'Create an entity',
} as const

export const t = makeT(messages)