/**
 * Per-song counting stats: shows appeared, times played, JC count,
 * duration thresholds, bustout detection via show index.
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { ShowIndex, SongCountingStats, BustoutTier } from './types'
import { BUSTOUT_BONUS } from './types'

const MS_20_MIN = 20 * 60 * 1000
const MS_25_MIN = 25 * 60 * 1000

export function classifyBustout(showGap: number): BustoutTier {
  if (showGap >= 250) return 'historic'
  if (showGap >= 100) return 'major'
  if (showGap >= 50) return 'significant'
  if (showGap >= 25) return 'bustout'
  return 'none'
}

export function bustoutScore(showGap: number): number {
  return BUSTOUT_BONUS[classifyBustout(showGap)]
}

export function computeCountingStats(
  tracks: TrackRow[],
  showIndex: ShowIndex
): SongCountingStats[] {
  // Group tracks by song name
  const bySong = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const list = bySong.get(t.song_name) || []
    list.push(t)
    bySong.set(t.song_name, list)
  }

  const results: SongCountingStats[] = []

  for (const [songName, songTracks] of bySong) {
    // Unique show dates for this song, sorted by show index
    const showDates = [...new Set(songTracks.map(t => t.show_date))]
      .sort((a, b) => (showIndex.dateToIndex.get(a) ?? 0) - (showIndex.dateToIndex.get(b) ?? 0))

    // Compute show gaps
    const gaps: number[] = []
    for (let i = 1; i < showDates.length; i++) {
      const prevIdx = showIndex.dateToIndex.get(showDates[i - 1]) ?? 0
      const currIdx = showIndex.dateToIndex.get(showDates[i]) ?? 0
      gaps.push(currIdx - prevIdx)
    }

    let bustoutCount = 0
    let megaBustoutCount = 0
    let maxGap = 0
    let totalGap = 0

    for (const gap of gaps) {
      if (gap >= 25) bustoutCount++
      if (gap >= 100) megaBustoutCount++
      if (gap > maxGap) maxGap = gap
      totalGap += gap
    }

    let jamchartCount = 0
    let times20Min = 0
    let times25Min = 0
    let totalMs = 0

    for (const t of songTracks) {
      if (t.is_jamchart) jamchartCount++
      if (t.duration_ms >= MS_20_MIN) times20Min++
      if (t.duration_ms >= MS_25_MIN) times25Min++
      totalMs += t.duration_ms
    }

    results.push({
      songName,
      showsAppearedIn: showDates.length,
      timesPlayed: songTracks.length,
      jamchartCount,
      times20Min,
      times25Min,
      totalMinutesPlayed: Math.round(totalMs / 60000 * 10) / 10,
      bustoutCount,
      megaBustoutCount,
      maxShowsBetweenPlays: maxGap,
      avgShowsBetweenPlays: gaps.length > 0 ? Math.round(totalGap / gaps.length * 10) / 10 : 0,
    })
  }

  return results
}
