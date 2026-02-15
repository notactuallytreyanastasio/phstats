import { describe, it, expect } from 'vitest'
import { computeLeaderboard, computeLeaderboardFromTracks, computeAggregatedLeaderboard } from './leaderboard'
import { filterTracks } from './filters'
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

describe('computeLeaderboardFromTracks', () => {
  it('produces same result as computeLeaderboard when given filtered tracks', () => {
    const tracks = buildTestDataset()
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 0, minShowsAppeared: 0 }
    const fromLeaderboard = computeLeaderboard(tracks, filter)
    const filtered = filterTracks(tracks, filter)
    const fromTracks = computeLeaderboardFromTracks(filtered, filter)
    expect(fromTracks).toEqual(fromLeaderboard)
  })

  it('returns empty for empty tracks', () => {
    expect(computeLeaderboardFromTracks([], DEFAULT_FILTER)).toEqual([])
  })
})

// Multi-year dataset for aggregation tests
function buildMultiYearDataset(): TrackRow[] {
  const tracks: TrackRow[] = []

  // Song A: played in both 2022 and 2023
  // 2022: 3 plays, 1 jamchart
  tracks.push(makeTrack({ song_name: 'A', show_date: '2022-07-01', set_name: 'Set 1', position: 1, duration_ms: 800000, is_jamchart: 1 }))
  tracks.push(makeTrack({ song_name: 'A', show_date: '2022-07-02', set_name: 'Set 1', position: 1, duration_ms: 600000 }))
  tracks.push(makeTrack({ song_name: 'A', show_date: '2022-07-03', set_name: 'Set 1', position: 1, duration_ms: 700000 }))

  // 2023: 2 plays, 0 jamcharts, shorter durations
  tracks.push(makeTrack({ song_name: 'A', show_date: '2023-01-01', set_name: 'Set 1', position: 1, duration_ms: 400000 }))
  tracks.push(makeTrack({ song_name: 'A', show_date: '2023-01-02', set_name: 'Set 1', position: 1, duration_ms: 350000 }))

  // Song B: only in 2022
  tracks.push(makeTrack({ song_name: 'B', show_date: '2022-07-01', set_name: 'Set 1', position: 2, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2022-07-02', set_name: 'Set 1', position: 2, duration_ms: 300000 }))
  tracks.push(makeTrack({ song_name: 'B', show_date: '2022-07-03', set_name: 'Set 1', position: 2, duration_ms: 300000 }))

  // Song C: only in 2023
  tracks.push(makeTrack({ song_name: 'C', show_date: '2023-01-01', set_name: 'Set 1', position: 2, duration_ms: 500000 }))
  tracks.push(makeTrack({ song_name: 'C', show_date: '2023-01-02', set_name: 'Set 1', position: 2, duration_ms: 500000 }))

  // Filler to give each show enough tracks
  tracks.push(makeTrack({ song_name: 'Filler', show_date: '2022-07-01', set_name: 'Set 1', position: 10, duration_ms: 200000 }))
  tracks.push(makeTrack({ song_name: 'Filler', show_date: '2022-07-02', set_name: 'Set 1', position: 10, duration_ms: 200000 }))
  tracks.push(makeTrack({ song_name: 'Filler', show_date: '2022-07-03', set_name: 'Set 1', position: 10, duration_ms: 200000 }))
  tracks.push(makeTrack({ song_name: 'Filler', show_date: '2023-01-01', set_name: 'Set 1', position: 10, duration_ms: 200000 }))
  tracks.push(makeTrack({ song_name: 'Filler', show_date: '2023-01-02', set_name: 'Set 1', position: 10, duration_ms: 200000 }))

  return tracks
}

describe('computeAggregatedLeaderboard', () => {
  const noQualFilter: PhanGraphsFilter = {
    ...DEFAULT_FILTER,
    yearStart: 2009,
    yearEnd: 2030,
    minTimesPlayed: 0,
    minShowsAppeared: 0,
    minJamchartCount: 0,
    minTotalMinutes: 0,
  }

  it('career mode returns entries with career aggregation key', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'career' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    expect(result.length).toBeGreaterThan(0)
    for (const entry of result) {
      expect(entry.aggregationKey.songName).toBe(entry.songName)
      expect(entry.aggregationKey.year).toBeUndefined()
      expect(entry.aggregationKey.tourId).toBeUndefined()
    }
  })

  it('career mode matches computeLeaderboard output', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'career' }
    const aggregated = computeAggregatedLeaderboard(tracks, filter)
    const classic = computeLeaderboard(tracks, filter)

    expect(aggregated.map(e => e.songName).sort()).toEqual(classic.map(e => e.songName).sort())
    for (const agg of aggregated) {
      const match = classic.find(c => c.songName === agg.songName)!
      expect(match).toBeDefined()
      expect(agg.counting).toEqual(match.counting)
      expect(agg.rates).toEqual(match.rates)
      expect(agg.war).toEqual(match.war)
      expect(agg.jis).toEqual(match.jis)
    }
  })

  it('byYear splits entries by year', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byYear' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    // Song A appears in both 2022 and 2023 → 2 entries
    const songAEntries = result.filter(e => e.songName === 'A')
    expect(songAEntries).toHaveLength(2)
    const years = songAEntries.map(e => e.aggregationKey.year).sort()
    expect(years).toEqual([2022, 2023])

    // Song B only in 2022 → 1 entry
    const songBEntries = result.filter(e => e.songName === 'B')
    expect(songBEntries).toHaveLength(1)
    expect(songBEntries[0].aggregationKey.year).toBe(2022)

    // Song C only in 2023 → 1 entry
    const songCEntries = result.filter(e => e.songName === 'C')
    expect(songCEntries).toHaveLength(1)
    expect(songCEntries[0].aggregationKey.year).toBe(2023)
  })

  it('byYear computes year-scoped counting stats', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byYear' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    // Song A in 2022: 3 plays, 1 jamchart
    const a2022 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2022)!
    expect(a2022).toBeDefined()
    expect(a2022.counting.timesPlayed).toBe(3)
    expect(a2022.counting.jamchartCount).toBe(1)

    // Song A in 2023: 2 plays, 0 jamcharts
    const a2023 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2023)!
    expect(a2023).toBeDefined()
    expect(a2023.counting.timesPlayed).toBe(2)
    expect(a2023.counting.jamchartCount).toBe(0)
  })

  it('byYear computes year-scoped rate stats', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byYear' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    const a2022 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2022)!
    const a2023 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2023)!

    // 2022 has 1/3 jamchart = 33.3%, 2023 has 0/2 = 0%
    expect(a2022.rates.jamRate).toBeCloseTo(1 / 3, 2)
    expect(a2023.rates.jamRate).toBe(0)

    // avgLength should differ: 2022 has longer durations
    expect(a2022.rates.avgLengthMs).toBeGreaterThan(a2023.rates.avgLengthMs)
  })

  it('byTour splits entries by tour', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byTour' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    // 2022-07-01/02/03 form one tour, 2023-01-01/02 form another (gap > 5 days)
    const songAEntries = result.filter(e => e.songName === 'A')
    expect(songAEntries).toHaveLength(2)
    expect(songAEntries.every(e => e.aggregationKey.tourId !== undefined)).toBe(true)
    expect(songAEntries.every(e => e.aggregationKey.tourLabel !== undefined)).toBe(true)
  })

  it('byTour has tour-scoped counting stats', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byTour' }
    const result = computeAggregatedLeaderboard(tracks, filter)

    // Song B only in summer 2022 tour → 1 entry with 3 plays
    const songBEntries = result.filter(e => e.songName === 'B')
    expect(songBEntries).toHaveLength(1)
    expect(songBEntries[0].counting.timesPlayed).toBe(3)
    expect(songBEntries[0].aggregationKey.tourLabel).toContain('Summer 2022')
  })

  it('returns empty for no tracks', () => {
    const filter: PhanGraphsFilter = { ...noQualFilter, aggregation: 'byYear' }
    expect(computeAggregatedLeaderboard([], filter)).toEqual([])
  })

  it('empty year bucket produces no entries', () => {
    const tracks = buildMultiYearDataset()
    // Filter to only 2024 — no data there
    const filter: PhanGraphsFilter = { ...noQualFilter, yearStart: 2024, yearEnd: 2024, aggregation: 'byYear' }
    expect(computeAggregatedLeaderboard(tracks, filter)).toEqual([])
  })

  it('applies qualifications per bucket', () => {
    const tracks = buildMultiYearDataset()
    const filter: PhanGraphsFilter = {
      ...noQualFilter,
      aggregation: 'byYear',
      minTimesPlayed: 3, // Song A in 2023 only has 2 plays, should be filtered
    }
    const result = computeAggregatedLeaderboard(tracks, filter)
    const a2023 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2023)
    expect(a2023).toBeUndefined()

    // Song A in 2022 has 3 plays, should remain
    const a2022 = result.find(e => e.songName === 'A' && e.aggregationKey.year === 2022)
    expect(a2022).toBeDefined()
  })
})
