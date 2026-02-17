/**
 * Date-derived utilities for PhanGraphs filtering.
 * Pure functions — no side effects.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Map a show date (YYYY-MM-DD) to its seasonal tour label. */
export function tourFromDate(dateStr: string): string {
  const month = parseInt(dateStr.substring(5, 7))
  if (month <= 3) return 'Winter'
  if (month <= 5) return 'Spring'
  if (month <= 8) return 'Summer'
  if (month <= 11) return 'Fall'
  return 'Holiday'
}

/** Map a show date (YYYY-MM-DD) to its day-of-week name. */
export function weekdayFromDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return WEEKDAYS[date.getDay()]
}
