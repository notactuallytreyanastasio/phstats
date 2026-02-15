/**
 * Multi-night venue run detection.
 * Groups consecutive shows at the same venue into runs.
 * Assigns each show its 1-indexed position within the run.
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { VenueRunInfo } from './types'

/**
 * Check if two YYYY-MM-DD dates are consecutive calendar days.
 */
function isConsecutiveDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + 'T00:00:00')
  const b = new Date(dateB + 'T00:00:00')
  const diffMs = b.getTime() - a.getTime()
  return diffMs === 86400000 // exactly 1 day
}

export function classifyVenueRuns(tracks: TrackRow[]): Map<string, VenueRunInfo> {
  // Extract unique (date, venue) pairs
  const showVenues = new Map<string, string>()
  for (const t of tracks) {
    if (!showVenues.has(t.show_date)) {
      showVenues.set(t.show_date, t.venue)
    }
  }

  // Sort by date
  const sorted = [...showVenues.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (sorted.length === 0) return new Map()

  // Group into runs: consecutive calendar dates at the same venue
  const runs: { dates: string[]; venue: string }[] = []
  let currentRun = { dates: [sorted[0][0]], venue: sorted[0][1] }

  for (let i = 1; i < sorted.length; i++) {
    const [date, venue] = sorted[i]
    const prevDate = currentRun.dates[currentRun.dates.length - 1]

    if (venue === currentRun.venue && isConsecutiveDay(prevDate, date)) {
      currentRun.dates.push(date)
    } else {
      runs.push(currentRun)
      currentRun = { dates: [date], venue }
    }
  }
  runs.push(currentRun)

  // Build the map
  const result = new Map<string, VenueRunInfo>()
  for (const run of runs) {
    const runLength = run.dates.length
    for (let i = 0; i < runLength; i++) {
      result.set(run.dates[i], {
        venue: run.venue,
        runLength,
        positionInRun: i + 1,
        isOpener: i === 0,
        isCloser: i === runLength - 1,
      })
    }
  }

  return result
}
