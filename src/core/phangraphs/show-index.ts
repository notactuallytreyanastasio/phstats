/**
 * Build an ordered index of all show dates for gap computation.
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { ShowIndex } from './types'

export function buildShowIndex(tracks: TrackRow[]): ShowIndex {
  const dateSet = new Set<string>()
  for (const t of tracks) {
    dateSet.add(t.show_date)
  }

  const dates = [...dateSet].sort()
  const dateToIndex = new Map<string, number>()
  for (let i = 0; i < dates.length; i++) {
    dateToIndex.set(dates[i], i)
  }

  return { dates, dateToIndex, totalShows: dates.length }
}
