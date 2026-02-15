import { describe, it, expect } from 'vitest'
import { TrackRow, computeVenueStats, computeJamEvolution, computeSongPairings } from './track-queries'

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

describe('computeVenueStats', () => {
  it('aggregates tracks by venue', () => {
    const tracks = [
      makeTrack({ venue: 'MSG', show_date: '2023-12-30', is_jamchart: 1 }),
      makeTrack({ venue: 'MSG', show_date: '2023-12-30', is_jamchart: 0 }),
      makeTrack({ venue: 'MSG', show_date: '2023-12-31', is_jamchart: 1 }),
      makeTrack({ venue: "Dick's", location: 'Commerce City, CO', show_date: '2023-09-01', is_jamchart: 1 }),
    ]
    const result = computeVenueStats(tracks, 'all')

    expect(result).toHaveLength(2)
    const msg = result.find(v => v.venue === 'MSG')!
    expect(msg.total_shows).toBe(2)
    expect(msg.total_tracks).toBe(3)
    expect(msg.jamchart_count).toBe(2)
    expect(msg.jamchart_pct).toBeCloseTo(66.7, 0)

    const dicks = result.find(v => v.venue === "Dick's")!
    expect(dicks.total_shows).toBe(1)
    expect(dicks.jamchart_count).toBe(1)
  })

  it('filters by year', () => {
    const tracks = [
      makeTrack({ venue: 'MSG', show_date: '2022-12-31', is_jamchart: 1 }),
      makeTrack({ venue: 'MSG', show_date: '2023-12-31', is_jamchart: 1 }),
    ]
    const result = computeVenueStats(tracks, '2023')
    expect(result).toHaveLength(1)
    expect(result[0].total_shows).toBe(1)
  })

  it('sorts by jamchart_count descending', () => {
    const tracks = [
      makeTrack({ venue: 'A', show_date: '2023-01-01', is_jamchart: 1 }),
      makeTrack({ venue: 'B', show_date: '2023-01-02', is_jamchart: 1 }),
      makeTrack({ venue: 'B', show_date: '2023-01-03', is_jamchart: 1 }),
    ]
    const result = computeVenueStats(tracks, 'all')
    expect(result[0].venue).toBe('B')
    expect(result[0].jamchart_count).toBe(2)
  })

  it('returns empty array for no tracks', () => {
    expect(computeVenueStats([], 'all')).toEqual([])
  })
})

describe('computeJamEvolution', () => {
  it('groups stats by year', () => {
    const tracks = [
      makeTrack({ show_date: '2022-08-01', is_jamchart: 1, duration_ms: 900000 }),
      makeTrack({ show_date: '2022-08-01', is_jamchart: 0, duration_ms: 300000 }),
      makeTrack({ show_date: '2023-07-15', is_jamchart: 1, duration_ms: 1200000 }),
    ]
    const result = computeJamEvolution(tracks)

    expect(result).toHaveLength(2)
    expect(result[0].year).toBe(2022)
    expect(result[0].total_shows).toBe(1)
    expect(result[0].total_tracks).toBe(2)
    expect(result[0].jamchart_count).toBe(1)
    expect(result[0].jc_per_show).toBe(1)
    expect(result[1].year).toBe(2023)
  })

  it('detects new jam vehicles', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2022-08-01', is_jamchart: 1 }),
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-01', is_jamchart: 1 }),
      makeTrack({ song_name: 'Blaze On', show_date: '2023-07-01', is_jamchart: 1 }),
    ]
    const result = computeJamEvolution(tracks)

    expect(result[0].new_vehicles).toEqual(['Tweezer']) // 2022: Tweezer first appears
    expect(result[1].new_vehicles).toEqual(['Blaze On']) // 2023: Blaze On is new
  })

  it('computes avg jam duration only from jamchart tracks', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01', is_jamchart: 1, duration_ms: 1000000 }),
      makeTrack({ show_date: '2023-01-01', is_jamchart: 0, duration_ms: 200000 }),
    ]
    const result = computeJamEvolution(tracks)
    expect(result[0].avg_jam_duration_ms).toBe(1000000)
    expect(result[0].avg_duration_ms).toBe(600000) // avg of both
  })

  it('returns sorted by year ascending', () => {
    const tracks = [
      makeTrack({ show_date: '2024-01-01' }),
      makeTrack({ show_date: '2022-01-01' }),
      makeTrack({ show_date: '2023-01-01' }),
    ]
    const result = computeJamEvolution(tracks)
    expect(result.map(r => r.year)).toEqual([2022, 2023, 2024])
  })
})

describe('computeSongPairings', () => {
  it('finds co-occurring jammed songs', () => {
    const tracks = [
      // Show 1: Tweezer + Ghost jammed
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-15', is_jamchart: 1 }),
      // Show 2: Tweezer + Ghost jammed again
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-16', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-16', is_jamchart: 1 }),
      // Show 3: Tweezer + Ghost + DWD jammed
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-17', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-17', is_jamchart: 1 }),
      makeTrack({ song_name: 'Down with Disease', show_date: '2023-07-17', is_jamchart: 1 }),
    ]
    const result = computeSongPairings(tracks, 'all', 2)

    const tweezerGhost = result.find(p =>
      (p.song_a === 'Ghost' && p.song_b === 'Tweezer') ||
      (p.song_a === 'Tweezer' && p.song_b === 'Ghost')
    )
    expect(tweezerGhost).toBeDefined()
    expect(tweezerGhost!.co_occurrences).toBe(3)
  })

  it('ignores non-jamchart tracks', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Bouncing', show_date: '2023-07-15', is_jamchart: 0 }),
    ]
    const result = computeSongPairings(tracks, 'all', 1)
    expect(result).toHaveLength(0) // only 1 jammed song per show, no pairs
  })

  it('respects minShows threshold', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-15', is_jamchart: 1 }),
    ]
    expect(computeSongPairings(tracks, 'all', 2)).toHaveLength(0) // only 1 co-occurrence
    expect(computeSongPairings(tracks, 'all', 1)).toHaveLength(1) // passes threshold
  })

  it('filters by year', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2022-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2022-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-15', is_jamchart: 1 }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-15', is_jamchart: 1 }),
    ]
    const result = computeSongPairings(tracks, '2023', 1)
    expect(result).toHaveLength(1)
    expect(result[0].co_occurrences).toBe(1) // only 2023 show counts
  })

  it('sorts by co_occurrences descending', () => {
    const tracks = [
      // A+B co-occur once
      makeTrack({ song_name: 'A', show_date: '2023-01-01', is_jamchart: 1 }),
      makeTrack({ song_name: 'B', show_date: '2023-01-01', is_jamchart: 1 }),
      // C+D co-occur twice
      makeTrack({ song_name: 'C', show_date: '2023-01-02', is_jamchart: 1 }),
      makeTrack({ song_name: 'D', show_date: '2023-01-02', is_jamchart: 1 }),
      makeTrack({ song_name: 'C', show_date: '2023-01-03', is_jamchart: 1 }),
      makeTrack({ song_name: 'D', show_date: '2023-01-03', is_jamchart: 1 }),
    ]
    const result = computeSongPairings(tracks, 'all', 1)
    expect(result[0].co_occurrences).toBe(2)
    expect(result[0].song_a).toBe('C')
  })
})
