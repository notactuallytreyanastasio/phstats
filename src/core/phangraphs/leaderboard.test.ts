import { describe, it, expect } from 'vitest'
import { computeLeaderboard } from './leaderboard'
import type { TrackRow } from '../track-queries'
import type { PhanGraphsFilter } from './types'
import { DEFAULT_FILTER } from './types'

function makeTrack(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    song_name: 'Tweezer',
    show_date: '2023-07-15',
    set_name: 'Set 1',
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

// Build a minimal but realistic dataset for end-to-end tests
function buildTestDataset(): TrackRow[] {
  const tracks: TrackRow[] = []

  // Song A: played 6 times across 3 shows, 2 jamcharts, one long jam
  tracks.push(makeTrack({ song_name: 'A', show_date: '2023-01-01', set_name: 'Set 1', position: 1, duration_ms: 600000, is_jamchart: 1 }))
  tracks.push(makeTrack({ song_name: 'A', show_date: '2023-01-02', set_name: 'Set 2', position: 11, duration_ms: 1500000, is_jamchart: 1 })) // 25 min
  tracks.push(makeTrack({ song_name: 'A', show_date: '2023-01-03', set_name: 'Set 1', position: 1, duration_ms: 500000 }))

  // Song B: played 5 times across 5 shows, 0 jamcharts
  tracks.push(makeTrack({ song_name: 'B', show_date: '2023-01-01', set_name: 'Set 1', position: 2, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2023-01-02', set_name: 'Set 1', position: 2, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2023-01-03', set_name: 'Set 1', position: 2, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2023-01-04', set_name: 'Set 1', position: 1, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2023-01-05', set_name: 'Set 1', position: 1, duration_ms: 300000 }))

  // Song C: played 3 times (will be filtered out by default minTimesPlayed=5)
  tracks.push(makeTrack({ song_name: 'C', show_date: '2023-01-01', set_name: 'Set 1', position: 5, duration_ms: 400000 }))
  tracks.push(makeTrack({ song_name: 'C', show_date: '2023-01-02', set_name: 'Set 1', position: 5, duration_ms: 400000 }))
  tracks.push(makeTrack({ song_name: 'C', show_date: '2023-01-03', set_name: 'Set 1', position: 5, duration_ms: 400000 }))

  // Filler tracks for closer positions
  tracks.push(makeTrack({ song_name: 'D', show_date: '2023-01-01', set_name: 'Set 1', position: 10 }))
  tracks.push(makeTrack({ song_name: 'D', show_date: '2023-01-02', set_name: 'Set 1', position: 10 }))
  tracks.push(makeTrack({ song_name: 'D', show_date: '2023-01-03', set_name: 'Set 1', position: 10 }))
  tracks.push(makeTrack({ song_name: 'D', show_date: '2023-01-04', set_name: 'Set 1', position: 10 }))
  tracks.push(makeTrack({ song_name: 'D', show_date: '2023-01-05', set_name: 'Set 1', position: 10 }))

  return tracks
}

describe('computeLeaderboard', () => {
  it('returns empty for no tracks', () => {
    expect(computeLeaderboard([], DEFAULT_FILTER)).toEqual([])
  })

  it('returns empty when all tracks filtered out by year', () => {
    const tracks = [makeTrack({ show_date: '2020-01-01' })]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2023, yearEnd: 2024, minTimesPlayed: 0, minShowsAppeared: 0 }
    expect(computeLeaderboard(tracks, filter)).toEqual([])
  })

  it('assembles complete leaderboard entries', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 3, minShowsAppeared: 2 }
    const result = computeLeaderboard(tracks, filter)

    // Should have songs A, B, C, D (all have ≥3 plays, ≥2 shows)
    expect(result.length).toBeGreaterThanOrEqual(3)

    for (const entry of result) {
      // Counting stats present
      expect(entry.counting.songName).toBe(entry.songName)
      expect(entry.counting.timesPlayed).toBeGreaterThan(0)

      // Rate stats present
      expect(entry.rates.songName).toBe(entry.songName)
      expect(entry.rates.avgLengthMs).toBeGreaterThan(0)

      // WAR present
      expect(entry.war.songName).toBe(entry.songName)
      expect(typeof entry.war.careerWAR).toBe('number')

      // JIS present
      expect(entry.jis.songName).toBe(entry.songName)
      expect(typeof entry.jis.avgJIS).toBe('number')
    }
  })

  it('applies qualification filters', () => {
    const tracks = buildTestDataset()
    // Song C has only 3 plays — default minTimesPlayed=5 should filter it
    const result = computeLeaderboard(tracks, DEFAULT_FILTER)
    const songNames = result.map(e => e.songName)
    expect(songNames).not.toContain('C')
  })

  it('jamchart songs have higher PVS components', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 0, minShowsAppeared: 0 }
    const result = computeLeaderboard(tracks, filter)

    const a = result.find(e => e.songName === 'A')!
    const b = result.find(e => e.songName === 'B')!
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    // A has jamcharts, B doesn't — A should have higher JAM rate
    expect(a.rates.jamRate).toBeGreaterThan(b.rates.jamRate)
  })

  it('filters by set split', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'set2', minTimesPlayed: 0, minShowsAppeared: 0 }
    const result = computeLeaderboard(tracks, filter)

    // Only Song A appears in Set 2 in our test data
    expect(result).toHaveLength(1)
    expect(result[0].songName).toBe('A')
  })

  it('filters by year range', () => {
    const tracks = [
      ...buildTestDataset(),
      makeTrack({ song_name: 'E', show_date: '2022-06-15', set_name: 'Set 1', position: 1 }),
      makeTrack({ song_name: 'E', show_date: '2022-06-16', set_name: 'Set 1', position: 1 }),
      makeTrack({ song_name: 'E', show_date: '2022-06-17', set_name: 'Set 1', position: 1 }),
      makeTrack({ song_name: 'E', show_date: '2022-06-18', set_name: 'Set 1', position: 1 }),
      makeTrack({ song_name: 'E', show_date: '2022-06-19', set_name: 'Set 1', position: 1 }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2022, yearEnd: 2022 }
    const result = computeLeaderboard(tracks, filter)
    const songNames = result.map(e => e.songName)
    expect(songNames).toContain('E')
    expect(songNames).not.toContain('A') // A is 2023 only
  })

  it('computes WAR correctly in pipeline', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 0, minShowsAppeared: 0 }
    const result = computeLeaderboard(tracks, filter)

    for (const entry of result) {
      // WAR should be a finite number
      expect(Number.isFinite(entry.war.careerWAR)).toBe(true)
      expect(entry.war.peakWARYear).toBe(2023) // all data is 2023
    }
  })

  it('computes JIS in 0-10 range', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 0, minShowsAppeared: 0 }
    const result = computeLeaderboard(tracks, filter)

    for (const entry of result) {
      expect(entry.jis.avgJIS).toBeGreaterThanOrEqual(0)
      expect(entry.jis.avgJIS).toBeLessThanOrEqual(10)
      expect(entry.jis.peakJIS).toBeGreaterThanOrEqual(0)
      expect(entry.jis.peakJIS).toBeLessThanOrEqual(10)
    }
  })
})
