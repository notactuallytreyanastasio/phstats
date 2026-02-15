/**
 * Track filtering and qualification logic for PhanGraphs.
 * Filters tracks by year range, set split, and positional criteria.
 * Applies qualification thresholds to leaderboard entries.
 * Pure functions — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { PhanGraphsFilter, LeaderboardEntry } from './types'

export function filterTracks(tracks: TrackRow[], filter: PhanGraphsFilter): TrackRow[] {
  let result = tracks

  // Year range filter
  result = result.filter(t => {
    const yr = parseInt(t.show_date.substring(0, 4))
    return yr >= filter.yearStart && yr <= filter.yearEnd
  })

  // Set split filter
  if (filter.setSplit !== 'all' && filter.setSplit !== 'opener' && filter.setSplit !== 'closer') {
    const setMap: Record<string, string> = {
      set1: 'Set 1',
      set2: 'Set 2',
      set3: 'Set 3',
      encore: 'Encore',
    }
    const target = setMap[filter.setSplit]
    if (target) {
      result = result.filter(t => t.set_name === target)
    }
  }

  // Positional filters (opener/closer) require finding min/max position per set per show
  if (filter.setSplit === 'opener' || filter.setSplit === 'closer') {
    const positionMap = buildPositionMap(result)
    result = result.filter(t => {
      const key = `${t.show_date}|${t.set_name}`
      const bounds = positionMap.get(key)
      if (!bounds) return false
      if (filter.setSplit === 'opener') return t.position === bounds.min
      return t.position === bounds.max
    })
  }

  return result
}

/** Build min/max position per (show_date, set_name) */
function buildPositionMap(tracks: TrackRow[]): Map<string, { min: number; max: number }> {
  const map = new Map<string, { min: number; max: number }>()
  for (const t of tracks) {
    const key = `${t.show_date}|${t.set_name}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { min: t.position, max: t.position })
    } else {
      if (t.position < existing.min) existing.min = t.position
      if (t.position > existing.max) existing.max = t.position
    }
  }
  return map
}

export function applyQualifications(
  entries: LeaderboardEntry[],
  filter: PhanGraphsFilter
): LeaderboardEntry[] {
  return entries.filter(e =>
    e.counting.timesPlayed >= filter.minTimesPlayed &&
    e.counting.showsAppearedIn >= filter.minShowsAppeared &&
    e.counting.jamchartCount >= filter.minJamchartCount &&
    e.counting.totalMinutesPlayed >= filter.minTotalMinutes
  )
}
