/**
 * Jam Impact Score (JIS) — normalized 0-10 from per-performance PVS.
 * Per-song: avgJIS, peakJIS, jisVolatility (std dev).
 * Pure function — no side effects.
 */

import type { PerformancePVS, SongJIS } from './types'

export function normalizeToJIS(pvs: number, pvsMin: number, pvsMax: number): number {
  if (pvsMax === pvsMin) return 5 // all same score
  const raw = 10 * (pvs - pvsMin) / (pvsMax - pvsMin)
  return Math.max(0, Math.min(10, Math.round(raw * 100) / 100))
}

export function computeJIS(allPVS: PerformancePVS[]): SongJIS[] {
  if (allPVS.length === 0) return []

  // Find global min/max PVS for normalization
  let pvsMin = Infinity
  let pvsMax = -Infinity
  for (const p of allPVS) {
    if (p.pvs < pvsMin) pvsMin = p.pvs
    if (p.pvs > pvsMax) pvsMax = p.pvs
  }

  // Normalize each performance to JIS scale
  const jisByPerf = allPVS.map(p => ({
    songName: p.songName,
    jis: normalizeToJIS(p.pvs, pvsMin, pvsMax),
  }))

  // Group by song
  const bySong = new Map<string, number[]>()
  for (const p of jisByPerf) {
    const list = bySong.get(p.songName) || []
    list.push(p.jis)
    bySong.set(p.songName, list)
  }

  const results: SongJIS[] = []
  for (const [songName, scores] of bySong) {
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length
    const peak = Math.max(...scores)
    const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length
    const stdDev = Math.sqrt(variance)

    results.push({
      songName,
      avgJIS: Math.round(avg * 100) / 100,
      peakJIS: Math.round(peak * 100) / 100,
      jisVolatility: Math.round(stdDev * 100) / 100,
    })
  }

  return results
}
