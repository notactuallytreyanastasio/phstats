import { describe, it, expect } from 'vitest'
import { classifyBustout, bustoutScore, computeCountingStats } from './counting-stats'
import { buildShowIndex } from './show-index'
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

describe('classifyBustout', () => {
  it('classifies no bustout for small gaps', () => {
    expect(classifyBustout(0)).toBe('none')
    expect(classifyBustout(24)).toBe('none')
  })

  it('classifies bustout (25-49)', () => {
    expect(classifyBustout(25)).toBe('bustout')
    expect(classifyBustout(49)).toBe('bustout')
  })

  it('classifies significant bustout (50-99)', () => {
    expect(classifyBustout(50)).toBe('significant')
    expect(classifyBustout(99)).toBe('significant')
  })

  it('classifies major bustout (100-249)', () => {
    expect(classifyBustout(100)).toBe('major')
    expect(classifyBustout(249)).toBe('major')
  })

  it('classifies historic bustout (250+)', () => {
    expect(classifyBustout(250)).toBe('historic')
    expect(classifyBustout(500)).toBe('historic')
  })
})

describe('bustoutScore', () => {
  it('returns correct PVS bonus values', () => {
    expect(bustoutScore(10)).toBe(0)
    expect(bustoutScore(30)).toBe(0.5)
    expect(bustoutScore(75)).toBe(1.0)
    expect(bustoutScore(150)).toBe(1.5)
    expect(bustoutScore(300)).toBe(2.5)
  })
})

describe('computeCountingStats', () => {
  it('computes basic counts for a single song', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2023-01-01', is_jamchart: 1, duration_ms: 1200000 }),
      makeTrack({ song_name: 'Tweezer', show_date: '2023-02-01', is_jamchart: 0, duration_ms: 600000 }),
      makeTrack({ song_name: 'Tweezer', show_date: '2023-03-01', is_jamchart: 1, duration_ms: 1500000 }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    expect(stats).toHaveLength(1)
    const s = stats[0]
    expect(s.songName).toBe('Tweezer')
    expect(s.showsAppearedIn).toBe(3)
    expect(s.timesPlayed).toBe(3)
    expect(s.jamchartCount).toBe(2)
  })

  it('counts 20+ and 25+ minute performances', () => {
    const tracks = [
      makeTrack({ duration_ms: 19 * 60000 }),   // 19 min
      makeTrack({ show_date: '2023-07-16', duration_ms: 20 * 60000 }),   // 20 min exactly
      makeTrack({ show_date: '2023-07-17', duration_ms: 25 * 60000 }),   // 25 min exactly
      makeTrack({ show_date: '2023-07-18', duration_ms: 30 * 60000 }),   // 30 min
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    expect(stats[0].times20Min).toBe(3) // 20, 25, 30
    expect(stats[0].times25Min).toBe(2) // 25, 30
  })

  it('computes total minutes played', () => {
    const tracks = [
      makeTrack({ duration_ms: 600000 }),  // 10 min
      makeTrack({ show_date: '2023-07-16', duration_ms: 300000 }),  // 5 min
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)
    expect(stats[0].totalMinutesPlayed).toBe(15)
  })

  it('detects bustouts using show index', () => {
    // Create 30 shows, song appears at show 0 and show 29 (gap of 29)
    const showDates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(2023, 0, i + 1)
      return d.toISOString().split('T')[0]
    })
    const tracks: TrackRow[] = [
      // All shows have some filler song
      ...showDates.map(d => makeTrack({ song_name: 'Filler', show_date: d })),
      // Target song appears at first and last show only
      makeTrack({ song_name: 'Rare', show_date: showDates[0] }),
      makeTrack({ song_name: 'Rare', show_date: showDates[29] }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    const rare = stats.find(s => s.songName === 'Rare')!
    expect(rare.showsAppearedIn).toBe(2)
    expect(rare.maxShowsBetweenPlays).toBe(29)
    expect(rare.bustoutCount).toBe(1)
    expect(rare.megaBustoutCount).toBe(0)
  })

  it('detects mega bustouts (100+ gap)', () => {
    const showDates = Array.from({ length: 110 }, (_, i) => {
      const d = new Date(2020, 0, i + 1)
      return d.toISOString().split('T')[0]
    })
    const tracks: TrackRow[] = [
      ...showDates.map(d => makeTrack({ song_name: 'Filler', show_date: d })),
      makeTrack({ song_name: 'MegaRare', show_date: showDates[0] }),
      makeTrack({ song_name: 'MegaRare', show_date: showDates[109] }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    const rare = stats.find(s => s.songName === 'MegaRare')!
    expect(rare.maxShowsBetweenPlays).toBe(109)
    expect(rare.bustoutCount).toBe(1)
    expect(rare.megaBustoutCount).toBe(1)
  })

  it('computes avg show gap', () => {
    // 4 shows, song plays at show 0, 10, 15, 30
    const showDates = Array.from({ length: 31 }, (_, i) => {
      const d = new Date(2023, 0, i + 1)
      return d.toISOString().split('T')[0]
    })
    const tracks: TrackRow[] = [
      ...showDates.map(d => makeTrack({ song_name: 'Filler', show_date: d })),
      makeTrack({ song_name: 'Test', show_date: showDates[0] }),
      makeTrack({ song_name: 'Test', show_date: showDates[10] }),
      makeTrack({ song_name: 'Test', show_date: showDates[15] }),
      makeTrack({ song_name: 'Test', show_date: showDates[30] }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    const test = stats.find(s => s.songName === 'Test')!
    // Gaps: 10, 5, 15. Avg = 10.0
    expect(test.avgShowsBetweenPlays).toBe(10)
    expect(test.maxShowsBetweenPlays).toBe(15)
  })

  it('handles song with single appearance (no gaps)', () => {
    const tracks = [
      makeTrack({ song_name: 'OneTime', show_date: '2023-07-15' }),
      makeTrack({ song_name: 'Filler', show_date: '2023-07-16' }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)

    const one = stats.find(s => s.songName === 'OneTime')!
    expect(one.showsAppearedIn).toBe(1)
    expect(one.maxShowsBetweenPlays).toBe(0)
    expect(one.avgShowsBetweenPlays).toBe(0)
    expect(one.bustoutCount).toBe(0)
  })

  it('returns empty array for no tracks', () => {
    const idx = buildShowIndex([])
    expect(computeCountingStats([], idx)).toEqual([])
  })

  it('handles multiple songs', () => {
    const tracks = [
      makeTrack({ song_name: 'A', show_date: '2023-01-01' }),
      makeTrack({ song_name: 'B', show_date: '2023-01-01' }),
      makeTrack({ song_name: 'A', show_date: '2023-01-02' }),
    ]
    const idx = buildShowIndex(tracks)
    const stats = computeCountingStats(tracks, idx)
    expect(stats).toHaveLength(2)
    expect(stats.find(s => s.songName === 'A')!.showsAppearedIn).toBe(2)
    expect(stats.find(s => s.songName === 'B')!.showsAppearedIn).toBe(1)
  })
})
