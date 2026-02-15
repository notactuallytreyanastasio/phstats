import { describe, it, expect } from 'vitest'
import {
  computeYearDurationStats, durationZScore, classifySetPosition,
  setLeverage, computeRarity, computeAllPVS,
} from './pvs'
import { buildShowIndex } from './show-index'
import { classifyRuns } from './run-classifier'
import type { TrackRow } from '../track-queries'
import type { YearDurationStats } from './types'

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
    venue: 'Saratoga PAC',
    location: 'Saratoga Springs, NY',
    ...overrides,
  }
}

describe('computeYearDurationStats', () => {
  it('computes mean and stddev per year', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01', duration_ms: 400000 }),
      makeTrack({ show_date: '2023-01-02', duration_ms: 600000 }),
      makeTrack({ show_date: '2023-01-03', duration_ms: 800000 }),
    ]
    const stats = computeYearDurationStats(tracks)
    expect(stats).toHaveLength(1)
    expect(stats[0].year).toBe(2023)
    expect(stats[0].meanDurationMs).toBe(600000)
    expect(stats[0].totalPerformances).toBe(3)
    // stddev of [400000, 600000, 800000] = 163299
    expect(stats[0].stdDevDurationMs).toBeGreaterThan(160000)
    expect(stats[0].stdDevDurationMs).toBeLessThan(170000)
  })

  it('separates by year', () => {
    const tracks = [
      makeTrack({ show_date: '2022-01-01', duration_ms: 500000 }),
      makeTrack({ show_date: '2023-01-01', duration_ms: 700000 }),
    ]
    const stats = computeYearDurationStats(tracks)
    expect(stats).toHaveLength(2)
    expect(stats[0].year).toBe(2022)
    expect(stats[1].year).toBe(2023)
  })

  it('returns sorted by year', () => {
    const tracks = [
      makeTrack({ show_date: '2024-01-01', duration_ms: 500000 }),
      makeTrack({ show_date: '2022-01-01', duration_ms: 500000 }),
    ]
    const stats = computeYearDurationStats(tracks)
    expect(stats[0].year).toBe(2022)
    expect(stats[1].year).toBe(2024)
  })
})

describe('durationZScore', () => {
  it('returns 0 for mean duration', () => {
    const ys: YearDurationStats = { year: 2023, meanDurationMs: 600000, stdDevDurationMs: 200000, totalPerformances: 100 }
    expect(durationZScore(600000, ys)).toBe(0)
  })

  it('returns positive for above-mean duration', () => {
    const ys: YearDurationStats = { year: 2023, meanDurationMs: 600000, stdDevDurationMs: 200000, totalPerformances: 100 }
    expect(durationZScore(800000, ys)).toBe(1)
  })

  it('returns negative for below-mean duration', () => {
    const ys: YearDurationStats = { year: 2023, meanDurationMs: 600000, stdDevDurationMs: 200000, totalPerformances: 100 }
    expect(durationZScore(400000, ys)).toBe(-1)
  })

  it('returns 0 for zero stddev', () => {
    const ys: YearDurationStats = { year: 2023, meanDurationMs: 600000, stdDevDurationMs: 0, totalPerformances: 100 }
    expect(durationZScore(800000, ys)).toBe(0)
  })
})

describe('classifySetPosition', () => {
  it('detects opener (min position in set)', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1', position: 1 }),
      makeTrack({ set_name: 'Set 1', position: 2 }),
      makeTrack({ set_name: 'Set 1', position: 3 }),
    ]
    expect(classifySetPosition(tracks[0], tracks)).toBe('opener')
  })

  it('detects closer (max position in set)', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1', position: 1 }),
      makeTrack({ set_name: 'Set 1', position: 2 }),
      makeTrack({ set_name: 'Set 1', position: 3 }),
    ]
    expect(classifySetPosition(tracks[2], tracks)).toBe('closer')
  })

  it('detects middle', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1', position: 1 }),
      makeTrack({ set_name: 'Set 1', position: 2 }),
      makeTrack({ set_name: 'Set 1', position: 3 }),
    ]
    expect(classifySetPosition(tracks[1], tracks)).toBe('middle')
  })

  it('handles global positions across sets', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1', position: 1 }),
      makeTrack({ set_name: 'Set 1', position: 10 }),
      makeTrack({ set_name: 'Set 2', position: 11 }),
      makeTrack({ set_name: 'Set 2', position: 20 }),
    ]
    // Position 11 is opener of Set 2
    expect(classifySetPosition(tracks[2], tracks)).toBe('opener')
    // Position 20 is closer of Set 2
    expect(classifySetPosition(tracks[3], tracks)).toBe('closer')
    // Position 10 is closer of Set 1
    expect(classifySetPosition(tracks[1], tracks)).toBe('closer')
  })
})

describe('setLeverage', () => {
  it('encore gets 0.75 base', () => {
    expect(setLeverage('Encore', 'middle')).toBe(1.0 * 1.0 * 0.75)
  })

  it('closer gets 0.5625 base', () => {
    expect(setLeverage('Set 1', 'closer')).toBe(0.75 * 1.0 * 0.75)
  })

  it('opener gets 0.375 base', () => {
    expect(setLeverage('Set 1', 'opener')).toBe(0.5 * 1.0 * 0.75)
  })

  it('middle gets 0', () => {
    expect(setLeverage('Set 1', 'middle')).toBe(0)
  })

  it('set 2 multiplier (1.2x)', () => {
    expect(setLeverage('Set 2', 'closer')).toBeCloseTo(0.75 * 1.2 * 0.75)
  })

  it('set 3 multiplier (1.3x)', () => {
    expect(setLeverage('Set 3', 'closer')).toBeCloseTo(0.75 * 1.3 * 0.75)
  })
})

describe('computeRarity', () => {
  it('returns 0 for most-played song', () => {
    // If a song is played every performance
    expect(computeRarity(100, 100)).toBe(0)
  })

  it('returns close to 1 for rarely-played song', () => {
    expect(computeRarity(1, 100)).toBe(0.99)
  })

  it('returns 0 for zero total performances', () => {
    expect(computeRarity(0, 0)).toBe(0)
  })
})

describe('computeAllPVS', () => {
  it('computes PVS for each performance', () => {
    const tracks = [
      makeTrack({ song_name: 'A', show_date: '2023-01-01', set_name: 'Set 1', position: 1, duration_ms: 600000, is_jamchart: 0 }),
      makeTrack({ song_name: 'B', show_date: '2023-01-01', set_name: 'Set 1', position: 2, duration_ms: 600000, is_jamchart: 1 }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    expect(pvs).toHaveLength(2)
    // Song B has jamchart bonus, should score higher
    const pvsA = pvs.find(p => p.songName === 'A')!
    const pvsB = pvs.find(p => p.songName === 'B')!
    expect(pvsB.pvs).toBeGreaterThan(pvsA.pvs)
    expect(pvsB.components.jamBonus).toBe(1.5)
    expect(pvsA.components.jamBonus).toBe(0)
  })

  it('gives set opener leverage', () => {
    const tracks = [
      makeTrack({ song_name: 'Opener', show_date: '2023-01-01', set_name: 'Set 1', position: 1 }),
      makeTrack({ song_name: 'Middle', show_date: '2023-01-01', set_name: 'Set 1', position: 2 }),
      makeTrack({ song_name: 'Closer', show_date: '2023-01-01', set_name: 'Set 1', position: 3 }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    const opener = pvs.find(p => p.songName === 'Opener')!
    const middle = pvs.find(p => p.songName === 'Middle')!
    const closer = pvs.find(p => p.songName === 'Closer')!

    expect(opener.components.setLeverage).toBeGreaterThan(middle.components.setLeverage)
    expect(closer.components.setLeverage).toBeGreaterThan(opener.components.setLeverage)
    expect(middle.components.setLeverage).toBe(0)
  })

  it('gives run leverage for NYE shows', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-31', venue: 'MSG', set_name: 'Set 1', position: 1 }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG', set_name: 'Set 1', position: 2 }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    expect(pvs[0].components.runLeverage).toBe(1.0) // NYE
  })

  it('gives higher run leverage for Halloween', () => {
    const tracks = [
      makeTrack({ show_date: '2023-10-31', venue: 'MSG', set_name: 'Set 1', position: 1 }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    expect(pvs[0].components.runLeverage).toBe(1.5) // Halloween
  })

  it('gives jamchart + duration bonuses', () => {
    const tracks = [
      makeTrack({
        show_date: '2023-01-01', set_name: 'Set 1', position: 1,
        is_jamchart: 1, duration_ms: 25 * 60 * 1000, // 25 min
      }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    // jamchart=1.5 + 20min=0.5 + 25min=1.0 = 3.0
    expect(pvs[0].components.jamBonus).toBe(3.0)
  })

  it('detects bustout in PVS', () => {
    // Create 30 shows, song plays at show 0 and show 29
    const showDates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2023, 0, i + 1)
      return d.toISOString().split('T')[0]
    })
    const tracks: TrackRow[] = [
      ...showDates.map(d => makeTrack({ song_name: 'Filler', show_date: d, set_name: 'Set 1', position: 1 })),
      makeTrack({ song_name: 'Rare', show_date: showDates[0], set_name: 'Set 1', position: 2 }),
      makeTrack({ song_name: 'Rare', show_date: showDates[29], set_name: 'Set 1', position: 2 }),
    ]
    const idx = buildShowIndex(tracks)
    const runs = classifyRuns(tracks)
    const yearStats = computeYearDurationStats(tracks)
    const pvs = computeAllPVS(tracks, idx, runs, yearStats)

    // The second "Rare" performance (show 29) has gap of 29 = bustout tier (+0.5)
    const rarePVS = pvs.filter(p => p.songName === 'Rare')
    const secondPlay = rarePVS.find(p => p.showDate === showDates[29])!
    expect(secondPlay.components.bustoutValue).toBe(0.5)

    // First play has no gap
    const firstPlay = rarePVS.find(p => p.showDate === showDates[0])!
    expect(firstPlay.components.bustoutValue).toBe(0)
  })

  it('returns empty for no tracks', () => {
    expect(computeAllPVS([], buildShowIndex([]), new Map(), [])).toEqual([])
  })
})
