/**
 * Leaderboard orchestrator.
 * Ties the full PhanGraphs pipeline together:
 * TrackRow[] + filter → LeaderboardEntry[]
 * Pure function — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type { PhanGraphsFilter, LeaderboardEntry } from './types'
import { buildShowIndex } from './show-index'
import { classifyRuns } from './run-classifier'
import { computeCountingStats } from './counting-stats'
import { computeRateStats } from './rate-stats'
import { computeYearDurationStats, computeAllPVS } from './pvs'
import { computeReplacementLevels, computeWAR } from './war'
import { computeJIS } from './jis'
import { filterTracks, applyQualifications } from './filters'

export function computeLeaderboard(
  allTracks: TrackRow[],
  filter: PhanGraphsFilter
): LeaderboardEntry[] {
  // Step 1: Filter tracks
  const tracks = filterTracks(allTracks, filter)
  if (tracks.length === 0) return []

  // Step 2: Build infrastructure
  const showIndex = buildShowIndex(tracks)
  const runMap = classifyRuns(tracks)
  const yearStats = computeYearDurationStats(tracks)

  // Step 3: Counting stats
  const countingStats = computeCountingStats(tracks, showIndex)

  // Step 4: PVS for all performances
  const allPVS = computeAllPVS(tracks, showIndex, runMap, yearStats)

  // Step 5: WAR
  const replacementLevels = computeReplacementLevels(allPVS)
  const warResults = computeWAR(allPVS, replacementLevels)

  // Step 6: JIS
  const jisResults = computeJIS(allPVS)

  // Step 7: Group tracks by song for rate stats
  const tracksBySong = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const list = tracksBySong.get(t.song_name) || []
    list.push(t)
    tracksBySong.set(t.song_name, list)
  }

  // Step 8: Rate stats per song
  const warMap = new Map(warResults.map(w => [w.songName, w]))
  const jisMap = new Map(jisResults.map(j => [j.songName, j]))

  // Step 9: Assemble leaderboard entries
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

  // Step 10: Apply qualifications
  return applyQualifications(entries, filter)
}
