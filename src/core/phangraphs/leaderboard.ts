/**
 * Leaderboard orchestrator.
 * Ties the full PhanGraphs pipeline together:
 * TrackRow[] + filter → LeaderboardEntry[]
 * Supports career, by-year, and by-tour aggregation modes.
 * Pure functions — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { PhanGraphsFilter, LeaderboardEntry, AggregatedLeaderboardEntry } from './types'
import { buildShowIndex } from './show-index'
import { classifyRuns } from './run-classifier'
import { computeCountingStats } from './counting-stats'
import { computeRateStats } from './rate-stats'
import { computeYearDurationStats, computeAllPVS } from './pvs'
import { computeReplacementLevels, computeWAR } from './war'
import { computeJIS } from './jis'
import { filterTracks, applyQualifications } from './filters'
import { identifyTours, buildTourDateMap } from './tour-classifier'

/** Run the full pipeline on pre-filtered tracks (steps 2-10). */
export function computeLeaderboardFromTracks(
  tracks: TrackRow[],
  filter: PhanGraphsFilter
): LeaderboardEntry[] {
  if (tracks.length === 0) return []

  // Build infrastructure
  const showIndex = buildShowIndex(tracks)
  const runMap = classifyRuns(tracks)
  const yearStats = computeYearDurationStats(tracks)

  // Counting stats
  const countingStats = computeCountingStats(tracks, showIndex)

  // PVS for all performances
  const allPVS = computeAllPVS(tracks, showIndex, runMap, yearStats)

  // WAR
  const replacementLevels = computeReplacementLevels(allPVS)
  const warResults = computeWAR(allPVS, replacementLevels)

  // JIS
  const jisResults = computeJIS(allPVS)

  // Group tracks by song for rate stats
  const tracksBySong = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const list = tracksBySong.get(t.song_name) || []
    list.push(t)
    tracksBySong.set(t.song_name, list)
  }

  // Assemble leaderboard entries
  const warMap = new Map(warResults.map(w => [w.songName, w]))
  const jisMap = new Map(jisResults.map(j => [j.songName, j]))
  const entries: LeaderboardEntry[] = []

  for (const counting of countingStats) {
    const songTracks = tracksBySong.get(counting.songName) || []
    const rates = computeRateStats(counting, songTracks, showIndex.totalShows)
    const war = warMap.get(counting.songName) ?? {
      songName: counting.songName,
      careerWAR: 0, warPerPlay: 0, warPerShow: 0, peakWARYear: 0, warByYear: {},
    }
    const jis = jisMap.get(counting.songName) ?? {
      songName: counting.songName,
      avgJIS: 0, peakJIS: 0, jisVolatility: 0,
    }

    entries.push({ songName: counting.songName, counting, rates, war, jis })
  }

  // Apply qualifications
  return applyQualifications(entries, filter)
}

/** Original pipeline: filter → compute. Thin wrapper around computeLeaderboardFromTracks. */
export function computeLeaderboard(
  allTracks: TrackRow[],
  filter: PhanGraphsFilter
): LeaderboardEntry[] {
  return computeLeaderboardFromTracks(filterTracks(allTracks, filter), filter)
}

/** Aggregated leaderboard: splits tracks into buckets (career/year/tour) and runs pipeline per bucket. */
export function computeAggregatedLeaderboard(
  allTracks: TrackRow[],
  filter: PhanGraphsFilter
): AggregatedLeaderboardEntry[] {
  const tracks = filterTracks(allTracks, filter)
  if (tracks.length === 0) return []

  if (filter.aggregation === 'career') {
    const entries = computeLeaderboardFromTracks(tracks, filter)
    return entries.map(e => ({
      ...e,
      aggregationKey: { songName: e.songName },
    }))
  }

  if (filter.aggregation === 'byYear') {
    // Split tracks by year
    const buckets = new Map<number, TrackRow[]>()
    for (const t of tracks) {
      const yr = parseInt(t.show_date.substring(0, 4))
      const list = buckets.get(yr) || []
      list.push(t)
      buckets.set(yr, list)
    }

    const result: AggregatedLeaderboardEntry[] = []
    for (const [year, yearTracks] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
      const entries = computeLeaderboardFromTracks(yearTracks, filter)
      for (const e of entries) {
        result.push({
          ...e,
          aggregationKey: { songName: e.songName, year },
        })
      }
    }
    return result
  }

  // byTour
  const tours = identifyTours(tracks)
  const tourDateMap = buildTourDateMap(tours)

  // Split tracks by tour
  const buckets = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const tour = tourDateMap.get(t.show_date)
    if (!tour) continue
    const list = buckets.get(tour.tourId) || []
    list.push(t)
    buckets.set(tour.tourId, list)
  }

  const result: AggregatedLeaderboardEntry[] = []
  for (const tour of tours) {
    const tourTracks = buckets.get(tour.tourId)
    if (!tourTracks || tourTracks.length === 0) continue
    const entries = computeLeaderboardFromTracks(tourTracks, filter)
    for (const e of entries) {
      result.push({
        ...e,
        aggregationKey: {
          songName: e.songName,
          tourId: tour.tourId,
          tourLabel: tour.tourLabel,
        },
      })
    }
  }
  return result
}
