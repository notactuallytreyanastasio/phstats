import { describe, it, expect } from 'vitest'
import { filterTracks, applyQualifications } from './filters'
import type { TrackRow } from '../track-queries'
import type { PhanGraphsFilter, LeaderboardEntry } from './types'
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

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    songName: 'Tweezer',
    counting: {
      songName: 'Tweezer',
      showsAppearedIn: 10,
      timesPlayed: 12,
      jamchartCount: 3,
      times20Min: 5,
      times25Min: 2,
      totalMinutesPlayed: 120,
      bustoutCount: 0,
      megaBustoutCount: 0,
      maxShowsBetweenPlays: 5,
      avgShowsBetweenPlays: 2,
    },
    rates: {
      songName: 'Tweezer',
      jamRate: 0.25,
      rate20Plus: 0.42,
      rate25Plus: 0.17,
      bustoutRate: 0,
      playsPerShow: 1.2,
      jamPerShow: 0.3,
      avgLengthMs: 600000,
      medianLengthMs: 580000,
    },
    war: {
      songName: 'Tweezer',
      careerWAR: 15.5,
      warPerPlay: 1.29,
      warPerShow: 1.55,
      peakWARYear: 2023,
      warByYear: { 2023: 15.5 },
    },
    jis: {
      songName: 'Tweezer',
      avgJIS: 7.2,
      peakJIS: 9.5,
      jisVolatility: 1.8,
    },
    ...overrides,
  }
}

describe('filterTracks', () => {
  it('filters by year range', () => {
    const tracks = [
      makeTrack({ show_date: '2020-01-01' }),
      makeTrack({ show_date: '2022-06-15' }),
      makeTrack({ show_date: '2024-03-01' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2021, yearEnd: 2023 }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2022-06-15')
  })

  it('includes boundary years', () => {
    const tracks = [
      makeTrack({ show_date: '2022-01-01' }),
      makeTrack({ show_date: '2023-12-31' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2022, yearEnd: 2023 }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(2)
  })

  it('filters by set split: set1', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1' }),
      makeTrack({ set_name: 'Set 2' }),
      makeTrack({ set_name: 'Encore' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'set1' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].set_name).toBe('Set 1')
  })

  it('filters by set split: set2', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1' }),
      makeTrack({ set_name: 'Set 2' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'set2' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].set_name).toBe('Set 2')
  })

  it('filters by set split: encore', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1' }),
      makeTrack({ set_name: 'Encore' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'encore' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].set_name).toBe('Encore')
  })

  it('filters by set split: all (no filtering)', () => {
    const tracks = [
      makeTrack({ set_name: 'Set 1' }),
      makeTrack({ set_name: 'Set 2' }),
      makeTrack({ set_name: 'Encore' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'all' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(3)
  })

  it('filters opener (min position per set per show)', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 1 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 5 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 10 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 2', position: 11 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 2', position: 15 }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'opener' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.position)).toEqual([1, 11])
  })

  it('filters closer (max position per set per show)', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 1 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 5 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 10 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 2', position: 11 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 2', position: 15 }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'closer' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.position)).toEqual([10, 15])
  })

  it('handles opener across multiple shows', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 1 }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1', position: 2 }),
      makeTrack({ show_date: '2023-01-02', set_name: 'Set 1', position: 1 }),
      makeTrack({ show_date: '2023-01-02', set_name: 'Set 1', position: 2 }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, setSplit: 'opener' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(2)
  })

  it('combines year range + set split', () => {
    const tracks = [
      makeTrack({ show_date: '2022-01-01', set_name: 'Set 1' }),
      makeTrack({ show_date: '2022-01-01', set_name: 'Set 2' }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 1' }),
      makeTrack({ show_date: '2023-01-01', set_name: 'Set 2' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2023, yearEnd: 2023, setSplit: 'set2' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-01-01')
    expect(result[0].set_name).toBe('Set 2')
  })

  it('returns empty for no matching tracks', () => {
    const tracks = [makeTrack({ show_date: '2020-01-01' })]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, yearStart: 2023, yearEnd: 2024 }
    expect(filterTracks(tracks, filter)).toEqual([])
  })

  it('returns empty for empty input', () => {
    expect(filterTracks([], DEFAULT_FILTER)).toEqual([])
  })

  it('filters by venue', () => {
    const tracks = [
      makeTrack({ venue: 'MSG' }),
      makeTrack({ venue: 'Red Rocks' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, venue: 'MSG' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].venue).toBe('MSG')
  })

  it('venue null passes all through', () => {
    const tracks = [
      makeTrack({ venue: 'MSG' }),
      makeTrack({ venue: 'Red Rocks' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, venue: null }
    expect(filterTracks(tracks, filter)).toHaveLength(2)
  })

  it('filters by state', () => {
    const tracks = [
      makeTrack({ location: 'New York, NY' }),
      makeTrack({ location: 'Morrison, CO' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, state: 'CO' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].location).toBe('Morrison, CO')
  })

  it('state null passes all through', () => {
    const tracks = [
      makeTrack({ location: 'New York, NY' }),
      makeTrack({ location: 'Morrison, CO' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, state: null }
    expect(filterTracks(tracks, filter)).toHaveLength(2)
  })

  it('filters country us', () => {
    const tracks = [
      makeTrack({ location: 'New York, NY' }),
      makeTrack({ location: 'Toronto, Ontario, Canada' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, country: 'us' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].location).toBe('New York, NY')
  })

  it('filters country international', () => {
    const tracks = [
      makeTrack({ location: 'New York, NY' }),
      makeTrack({ location: 'Toronto, Ontario, Canada' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, country: 'international' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].location).toBe('Toronto, Ontario, Canada')
  })

  it('country all passes all through', () => {
    const tracks = [
      makeTrack({ location: 'New York, NY' }),
      makeTrack({ location: 'Toronto, Ontario, Canada' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, country: 'all' }
    expect(filterTracks(tracks, filter)).toHaveLength(2)
  })

  it('filters by run position n1', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, runPosition: 'n1' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-12-29')
  })

  it('filters by run position n2', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, runPosition: 'n2' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-12-30')
  })

  it('filters by run position closer', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, runPosition: 'closer' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-12-31')
  })

  it('filters by run position opener', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, runPosition: 'opener' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-12-29')
  })

  it('run position all passes all through', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, runPosition: 'all' }
    expect(filterTracks(tracks, filter)).toHaveLength(2)
  })

  it('combines venue + state + run position', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG', location: 'New York, NY' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG', location: 'New York, NY' }),
      makeTrack({ show_date: '2023-07-15', venue: 'Red Rocks', location: 'Morrison, CO' }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, venue: 'MSG', state: 'NY', runPosition: 'closer' }
    const result = filterTracks(tracks, filter)
    expect(result).toHaveLength(1)
    expect(result[0].show_date).toBe('2023-12-30')
  })
})

describe('applyQualifications', () => {
  it('filters by minTimesPlayed', () => {
    const entries = [
      makeEntry({ counting: { ...makeEntry().counting, timesPlayed: 10 } }),
      makeEntry({ counting: { ...makeEntry().counting, timesPlayed: 3 } }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 5 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(1)
  })

  it('filters by minShowsAppeared', () => {
    const entries = [
      makeEntry({ counting: { ...makeEntry().counting, showsAppearedIn: 10 } }),
      makeEntry({ counting: { ...makeEntry().counting, showsAppearedIn: 2 } }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minShowsAppeared: 5 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(1)
  })

  it('filters by minJamchartCount', () => {
    const entries = [
      makeEntry({ counting: { ...makeEntry().counting, jamchartCount: 5 } }),
      makeEntry({ counting: { ...makeEntry().counting, jamchartCount: 0 } }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minJamchartCount: 3 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(1)
  })

  it('filters by minTotalMinutes', () => {
    const entries = [
      makeEntry({ counting: { ...makeEntry().counting, totalMinutesPlayed: 200 } }),
      makeEntry({ counting: { ...makeEntry().counting, totalMinutesPlayed: 30 } }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTotalMinutes: 100 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(1)
  })

  it('combines multiple qualifications', () => {
    const entries = [
      makeEntry({ counting: { ...makeEntry().counting, timesPlayed: 10, showsAppearedIn: 8, jamchartCount: 5 } }),
      makeEntry({ counting: { ...makeEntry().counting, timesPlayed: 10, showsAppearedIn: 8, jamchartCount: 1 } }),
      makeEntry({ counting: { ...makeEntry().counting, timesPlayed: 2, showsAppearedIn: 2, jamchartCount: 5 } }),
    ]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 5, minShowsAppeared: 5, minJamchartCount: 3 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(1)
  })

  it('returns all with zero thresholds', () => {
    const entries = [makeEntry(), makeEntry()]
    const filter: PhanGraphsFilter = { ...DEFAULT_FILTER, minTimesPlayed: 0, minShowsAppeared: 0, minJamchartCount: 0, minTotalMinutes: 0 }
    const result = applyQualifications(entries, filter)
    expect(result).toHaveLength(2)
  })

  it('returns empty for no entries', () => {
    expect(applyQualifications([], DEFAULT_FILTER)).toEqual([])
  })
})
