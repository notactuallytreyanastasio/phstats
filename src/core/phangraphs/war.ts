/**
 * Wins Above Replacement (WAR) computation.
 * Replacement level = 20th percentile PVS per year.
 * WAR = sum of (PVS - replacement) for performances above replacement.
 * Pure functions — no side effects.
 */

import type { PerformancePVS, SongWAR } from './types'

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0
  const idx = (p / 100) * (sortedValues.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sortedValues[lower]
  const frac = idx - lower
  return sortedValues[lower] * (1 - frac) + sortedValues[upper] * frac
}

export function computeReplacementLevels(allPVS: PerformancePVS[]): Map<number, number> {
  const byYear = new Map<number, number[]>()
  for (const p of allPVS) {
    const yr = parseInt(p.showDate.substring(0, 4))
    const list = byYear.get(yr) || []
    list.push(p.pvs)
    byYear.set(yr, list)
  }

  const levels = new Map<number, number>()
  for (const [yr, values] of byYear) {
    values.sort((a, b) => a - b)
    levels.set(yr, percentile(values, 20))
  }

  return levels
}

export function computeWAR(
  allPVS: PerformancePVS[],
  replacementLevels: Map<number, number>
): SongWAR[] {
  // Group by song
  const bySong = new Map<string, PerformancePVS[]>()
  for (const p of allPVS) {
    const list = bySong.get(p.songName) || []
    list.push(p)
    bySong.set(p.songName, list)
  }

  // Count unique shows per song
  const songShows = new Map<string, Set<string>>()
  for (const p of allPVS) {
    const shows = songShows.get(p.songName) || new Set()
    shows.add(p.showDate)
    songShows.set(p.songName, shows)
  }

  const results: SongWAR[] = []

  for (const [songName, perfs] of bySong) {
    const warByYear: Record<number, number> = {}
    let careerWAR = 0

    for (const p of perfs) {
      const yr = parseInt(p.showDate.substring(0, 4))
      const replacement = replacementLevels.get(yr) ?? 0
      const contribution = p.pvs - replacement
      // WAR counts all contributions, positive and negative
      warByYear[yr] = (warByYear[yr] ?? 0) + contribution
      careerWAR += contribution
    }

    const showCount = songShows.get(songName)?.size ?? 1
    let peakYear = 0
    let peakWAR = -Infinity
    for (const [yr, war] of Object.entries(warByYear)) {
      if (war > peakWAR) {
        peakWAR = war
        peakYear = parseInt(yr)
      }
    }

    results.push({
      songName,
      careerWAR: Math.round(careerWAR * 100) / 100,
      warPerPlay: perfs.length > 0 ? Math.round(careerWAR / perfs.length * 100) / 100 : 0,
      warPerShow: showCount > 0 ? Math.round(careerWAR / showCount * 100) / 100 : 0,
      peakWARYear: peakYear,
      warByYear: Object.fromEntries(
        Object.entries(warByYear).map(([yr, w]) => [yr, Math.round(w * 100) / 100])
      ),
    })
  }

  return results
}
