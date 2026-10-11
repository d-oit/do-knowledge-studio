/**
 * Shared Intl formatters for date and time formatting.
 * Uses `undefined` locale to respect the user's browser runtime locale settings.
 */

export const shortDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
})

export const fullDate = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export const timeOfDay = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export const relativeTime = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
})
