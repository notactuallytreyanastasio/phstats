/**
 * Performance Value Score (PVS) computation.
 * Scores each individual performance based on length, jam status,
 * bustout value, set position, run type, and rarity.
 * Pure functions — no side effects.
 */

import type { TrackRow } from '../track-queries'
import type {
  ShowIndex, YearDurationStats, PerformancePVS,
  RunType, SetPosition, PVSComponents,
} from './types'
import { RUN_LEVERAGE } from './types'
import { bustoutScore } from './counting-stats'

const MS_20_MIN = 20 * 60 * 1000
const MS_25_MIN = 25 * 60 * 1000

// --- Year Duration Stats ---

export function computeYearDurationStats(tracks: TrackRow[]): YearDurationStats[] {
  const byYear = new Map<number, number[]>()
  for (const t of tracks) {
    const yr = parseInt(t.show_date.substring(0, 4))
    const list = byYear.get(yr) || []
    list.push(t.duration_ms)
    byYear.set(yr, list)
  }

  const results: YearDurationStats[] = []
  for (const [year, durations] of byYear) {
    const n = durations.length
    const mean = durations.reduce((s, d) => s + d, 0) / n
    const variance = durations.reduce((s, d) => s + (d - mean) ** 2, 0) / n
    const stdDev = Math.sqrt(variance)

    results.push({
      year,
      meanDurationMs: Math.round(mean),
      stdDevDurationMs: Math.round(stdDev),
      totalPerformances: n,
    })
  }

  return results.sort((a, b) => a.year - b.year)
}

// --- Z-Score ---

export function durationZScore(durationMs: number, yearStats: YearDurationStats): number {
  if (yearStats.stdDevDurationMs === 0) return 0
  return (durationMs - yearStats.meanDurationMs) / yearStats.stdDevDurationMs
}

// --- Set Position Classification ---

export function classifySetPosition(
  track: TrackRow,
  allTracksInShow: TrackRow[]
): SetPosition {
  // Find all tracks in the same set for this show
  const sameSet = allTracksInShow.filter(
    t => t.show_date === track.show_date && t.set_name === track.set_name
  )

  let minPos = Infinity
  let maxPos = -Infinity
  for (const t of sameSet) {
    if (t.position < minPos) minPos = t.position
    if (t.position > maxPos) maxPos = t.position
  }

  if (track.position === minPos) return 'opener'
  if (track.position === maxPos) return 'closer'
  return 'middle'
}

// --- Set Leverage ---

export function setLeverage(setName: string, position: SetPosition): number {
  const isEncore = setName.toLowerCase().includes('encore')

  let baseLeverage: number
  if (isEncore) {
    baseLeverage = 1.0
  } else if (position === 'closer') {
    baseLeverage = 0.75
  } else if (position === 'opener') {
    baseLeverage = 0.5
  } else {
    baseLeverage = 0
  }

  // Set multiplier
  let setMult = 1.0
  if (setName === 'Set 2') setMult = 1.2
  else if (setName === 'Set 3') setMult = 1.3

  return baseLeverage * setMult * 0.75
}

// --- Rarity ---

export function computeRarity(songPlaysInYear: number, totalPerformancesInYear: number): number {
  if (totalPerformancesInYear === 0) return 0
  return 1 - (songPlaysInYear / totalPerformancesInYear)
}

// --- Full PVS Assembly ---

export function computeAllPVS(
  tracks: TrackRow[],
  showIndex: ShowIndex,
  runMap: Map<string, RunType>,
  yearStats: YearDurationStats[]
): PerformancePVS[] {
  const yearStatsMap = new Map(yearStats.map(ys => [ys.year, ys]))

  // Pre-compute: group tracks by show for set position detection
  const tracksByShow = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const list = tracksByShow.get(t.show_date) || []
    list.push(t)
    tracksByShow.set(t.show_date, list)
  }

  // Pre-compute: song plays per year for rarity
  const songYearPlays = new Map<string, number>() // "songName|year" -> count
  const yearTotalPerfs = new Map<number, number>()
  for (const t of tracks) {
    const yr = parseInt(t.show_date.substring(0, 4))
    const key = `${t.song_name}|${yr}`
    songYearPlays.set(key, (songYearPlays.get(key) ?? 0) + 1)
    yearTotalPerfs.set(yr, (yearTotalPerfs.get(yr) ?? 0) + 1)
  }

  // Pre-compute: per-song show appearances ordered for bustout gap
  const songShowIndices = new Map<string, number[]>()
  for (const t of tracks) {
    const idx = showIndex.dateToIndex.get(t.show_date)
    if (idx === undefined) continue
    const existing = songShowIndices.get(t.song_name)
    if (!existing) {
      songShowIndices.set(t.song_name, [idx])
    } else if (existing[existing.length - 1] !== idx) {
      // Only add if different from last (tracks are often grouped by show)
      existing.push(idx)
    }
  }
  // Sort and deduplicate
  for (const [, indices] of songShowIndices) {
    const unique = [...new Set(indices)].sort((a, b) => a - b)
    indices.length = 0
    indices.push(...unique)
  }

  const results: PerformancePVS[] = []

  for (const t of tracks) {
    const yr = parseInt(t.show_date.substring(0, 4))
    const ys = yearStatsMap.get(yr)
    const showTracks = tracksByShow.get(t.show_date) || []
    const run = runMap.get(t.show_date) || 'regular'

    // Length component
    const zScore = ys ? durationZScore(t.duration_ms, ys) : 0
    const lengthValue = 1.5 * zScore

    // Jam component
    let jamBonus = 0
    if (t.is_jamchart) jamBonus += 1.5
    if (t.duration_ms >= MS_20_MIN) jamBonus += 0.5
    if (t.duration_ms >= MS_25_MIN) jamBonus += 1.0

    // Bustout component
    const showIdx = showIndex.dateToIndex.get(t.show_date) ?? 0
    const songIndices = songShowIndices.get(t.song_name) || []
    const posInSongHistory = songIndices.indexOf(showIdx)
    let showGap = 0
    if (posInSongHistory > 0) {
      showGap = showIdx - songIndices[posInSongHistory - 1]
    }
    const bustoutValue = bustoutScore(showGap)

    // Set leverage
    const setPos = classifySetPosition(t, showTracks)
    const setLev = setLeverage(t.set_name, setPos)

    // Run leverage
    const runLev = RUN_LEVERAGE[run]

    // Rarity
    const songPlays = songYearPlays.get(`${t.song_name}|${yr}`) ?? 0
    const totalPerfs = yearTotalPerfs.get(yr) ?? 0
    const rarityValue = computeRarity(songPlays, totalPerfs)

    const components: PVSComponents = {
      lengthValue,
      jamBonus,
      bustoutValue,
      setLeverage: setLev,
      runLeverage: runLev,
      rarityValue,
    }

    const pvs = lengthValue + jamBonus + bustoutValue + setLev + runLev + rarityValue

    results.push({
      songName: t.song_name,
      showDate: t.show_date,
      pvs,
      components,
    })
  }

  return results
}
