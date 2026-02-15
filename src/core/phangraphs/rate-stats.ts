/**
 * Rate stats derived from counting stats.
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { SongCountingStats, SongRateStats } from './types'

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

export function computeRateStats(
  counting: SongCountingStats,
  songTracks: TrackRow[],
  totalShowsInFilter: number
): SongRateStats {
  const tp = counting.timesPlayed
  const durations = songTracks.map(t => t.duration_ms)
  const totalDur = durations.reduce((sum, d) => sum + d, 0)

  return {
    songName: counting.songName,
    jamRate: tp > 0 ? Math.round(1000 * counting.jamchartCount / tp) / 1000 : 0,
    rate20Plus: tp > 0 ? Math.round(1000 * counting.times20Min / tp) / 1000 : 0,
    rate25Plus: tp > 0 ? Math.round(1000 * counting.times25Min / tp) / 1000 : 0,
    bustoutRate: tp > 0 ? Math.round(1000 * counting.bustoutCount / tp) / 1000 : 0,
    playsPerShow: totalShowsInFilter > 0 ? Math.round(1000 * tp / totalShowsInFilter) / 1000 : 0,
    jamPerShow: totalShowsInFilter > 0 ? Math.round(1000 * counting.jamchartCount / totalShowsInFilter) / 1000 : 0,
    avgLengthMs: tp > 0 ? Math.round(totalDur / tp) : 0,
    medianLengthMs: Math.round(median(durations)),
  }
}
