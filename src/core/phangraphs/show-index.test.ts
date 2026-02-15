import { describe, it, expect } from 'vitest'
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

describe('buildShowIndex', () => {
  it('returns empty index for no tracks', () => {
    const idx = buildShowIndex([])
    expect(idx.dates).toEqual([])
    expect(idx.totalShows).toBe(0)
    expect(idx.dateToIndex.size).toBe(0)
  })

  it('builds index from single show', () => {
    const tracks = [makeTrack({ show_date: '2023-07-15' })]
    const idx = buildShowIndex(tracks)
    expect(idx.dates).toEqual(['2023-07-15'])
    expect(idx.totalShows).toBe(1)
    expect(idx.dateToIndex.get('2023-07-15')).toBe(0)
  })

  it('deduplicates multiple tracks from same show', () => {
    const tracks = [
      makeTrack({ song_name: 'Tweezer', show_date: '2023-07-15' }),
      makeTrack({ song_name: 'Ghost', show_date: '2023-07-15' }),
      makeTrack({ song_name: 'DWD', show_date: '2023-07-15' }),
    ]
    const idx = buildShowIndex(tracks)
    expect(idx.dates).toEqual(['2023-07-15'])
    expect(idx.totalShows).toBe(1)
  })

  it('sorts dates chronologically', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-31' }),
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2023-01-01' }),
    ]
    const idx = buildShowIndex(tracks)
    expect(idx.dates).toEqual(['2023-01-01', '2023-07-15', '2023-12-31'])
  })

  it('assigns correct ordinal indices', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-31' }),
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2023-01-01' }),
    ]
    const idx = buildShowIndex(tracks)
    expect(idx.dateToIndex.get('2023-01-01')).toBe(0)
    expect(idx.dateToIndex.get('2023-07-15')).toBe(1)
    expect(idx.dateToIndex.get('2023-12-31')).toBe(2)
  })

  it('handles multi-year data', () => {
    const tracks = [
      makeTrack({ show_date: '2022-08-01' }),
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2024-01-01' }),
    ]
    const idx = buildShowIndex(tracks)
    expect(idx.totalShows).toBe(3)
    expect(idx.dates[0]).toBe('2022-08-01')
    expect(idx.dates[2]).toBe('2024-01-01')
  })

  it('computes correct gap between shows via index', () => {
    const tracks = [
      makeTrack({ show_date: '2023-01-01' }),
      makeTrack({ show_date: '2023-02-01' }),
      makeTrack({ show_date: '2023-03-01' }),
      makeTrack({ show_date: '2023-04-01' }),
      makeTrack({ show_date: '2023-05-01' }),
    ]
    const idx = buildShowIndex(tracks)
    // Gap between show 0 and show 4 = 4 shows
    const gap = idx.dateToIndex.get('2023-05-01')! - idx.dateToIndex.get('2023-01-01')!
    expect(gap).toBe(4)
  })
})
