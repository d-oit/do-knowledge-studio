import { TRIZ_PARAMETERS } from '@/lib/studio/triz-data'

/** Shared filter: maps TRIZ parameters to selectable items and filters by query. */
export const filterParams = (query: string) =>
  TRIZ_PARAMETERS.map((label, index) => ({ label, index })).filter(
    (parameter) => !query || parameter.label.toLowerCase().includes(query.toLowerCase()),
  )
