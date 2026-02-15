import { describe, it, expect } from 'vitest'
import { median, computeRateStats } from './rate-stats'
import type { SongCountingStats } from './types'
import type { TrackRow } from '../track-queries'

function makeTrack(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    song_name: 'Tweezer',
    show_date: '2023-07-15',
    set_name: 'Set 2',
    position: 3,
    duration_ms: 600000,
    likes: 10,
    is_jamchart: 0,
    jam_notes: '',
    venue: 'MSG',
    location: 'New York, NY',
    ...overrides,
  }
}

function makeCounting(overrides: Partial<SongCountingStats> = {}): SongCountingStats {
  return {
    songName: 'Tweezer',
    showsAppearedIn: 10,
    timesPlayed: 10,
    jamchartCount: 4,
    times20Min: 3,
    times25Min: 1,
    totalMinutesPlayed: 120,
    bustoutCount: 2,
    megaBustoutCount: 0,
    maxShowsBetweenPlays: 40,
    avgShowsBetweenPlays: 20,
    ...overrides,
  }
}

describe('median', () => {
  it('returns 0 for empty array', () => {
    expect(median([])).toBe(0)
  })

  it('returns single value', () => {
    expect(median([5])).toBe(5)
  })

  it('returns middle for odd count', () => {
    expect(median([1, 3, 5])).toBe(3)
  })

  it('returns average of middle two for even count', () => {
    expect(median([1, 3, 5, 7])).toBe(4)
  })

  it('handles unsorted input', () => {
    expect(median([5, 1, 3])).toBe(3)
  })
})

describe('computeRateStats', () => {
  it('computes jam rate', () => {
    const counting = makeCounting({ timesPlayed: 10, jamchartCount: 4 })
    const tracks = Array.from({ length: 10 }, () => makeTrack())
    const rates = computeRateStats(counting, tracks, 100)
    expect(rates.jamRate).toBe(0.4)
  })

  it('computes 20+ and 25+ rates', () => {
    const counting = makeCounting({ timesPlayed: 10, times20Min: 3, times25Min: 1 })
    const tracks = Array.from({ length: 10 }, () => makeTrack())
    const rates = computeRateStats(counting, tracks, 100)
    expect(rates.rate20Plus).toBe(0.3)
    expect(rates.rate25Plus).toBe(0.1)
  })

  it('computes bustout rate', () => {
    const counting = makeCounting({ timesPlayed: 10, bustoutCount: 2 })
    const tracks = Array.from({ length: 10 }, () => makeTrack())
    const rates = computeRateStats(counting, tracks, 100)
    expect(rates.bustoutRate).toBe(0.2)
  })

  it('computes plays per show and jam per show', () => {
    const counting = makeCounting({ timesPlayed: 10, jamchartCount: 4 })
    const tracks = Array.from({ length: 10 }, () => makeTrack())
    const rates = computeRateStats(counting, tracks, 100)
    expect(rates.playsPerShow).toBe(0.1)
    expect(rates.jamPerShow).toBe(0.04)
  })

  it('computes avg and median length', () => {
    const counting = makeCounting({ timesPlayed: 3 })
    const tracks = [
      makeTrack({ duration_ms: 600000 }),  // 10 min
      makeTrack({ duration_ms: 900000 }),  // 15 min
      makeTrack({ duration_ms: 1200000 }), // 20 min
    ]
    const rates = computeRateStats(counting, tracks, 100)
    expect(rates.avgLengthMs).toBe(900000)
    expect(rates.medianLengthMs).toBe(900000)
  })

  it('handles zero times played', () => {
    const counting = makeCounting({ timesPlayed: 0, jamchartCount: 0 })
    const rates = computeRateStats(counting, [], 100)
    expect(rates.jamRate).toBe(0)
    expect(rates.avgLengthMs).toBe(0)
  })

  it('handles zero total shows', () => {
    const counting = makeCounting({ timesPlayed: 5 })
    const tracks = Array.from({ length: 5 }, () => makeTrack())
    const rates = computeRateStats(counting, tracks, 0)
    expect(rates.playsPerShow).toBe(0)
    expect(rates.jamPerShow).toBe(0)
  })
})
