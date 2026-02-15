import { describe, it, expect } from 'vitest'
import { identifyTours, buildTourDateMap, seasonLabel } from './tour-classifier'
import type { TrackRow } from '../track-queries'

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
    venue: 'MSG',
    location: 'New York, NY',
    ...overrides,
  }
}

describe('seasonLabel', () => {
  it('labels summer tour', () => {
    expect(seasonLabel('2023-06-20', '2023-07-08')).toBe('Summer 2023')
  })

  it('labels fall tour', () => {
    expect(seasonLabel('2023-10-01', '2023-10-31')).toBe('Fall 2023')
  })

  it('labels winter tour', () => {
    expect(seasonLabel('2023-02-15', '2023-03-05')).toBe('Winter 2023')
  })

  it('labels spring tour', () => {
    expect(seasonLabel('2023-04-10', '2023-05-15')).toBe('Spring 2023')
  })

  it('labels NYE run (ends Dec 28-31)', () => {
    expect(seasonLabel('2023-12-28', '2023-12-31')).toBe('NYE 2023')
  })

  it('labels December tour not ending NYE as Winter', () => {
    expect(seasonLabel('2023-12-01', '2023-12-15')).toBe('Winter 2023')
  })

  it('uses start date year', () => {
    expect(seasonLabel('2022-12-28', '2023-01-01')).toBe('NYE 2022')
  })
})

describe('identifyTours', () => {
  it('returns empty for no tracks', () => {
    expect(identifyTours([])).toEqual([])
  })

  it('single show is its own tour', () => {
    const tracks = [makeTrack({ show_date: '2023-07-15' })]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(1)
    expect(tours[0].showCount).toBe(1)
    expect(tours[0].shows).toEqual(['2023-07-15'])
  })

  it('consecutive shows within threshold form one tour', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2023-07-16' }),
      makeTrack({ show_date: '2023-07-18' }), // 2 day gap, within 5
    ]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(1)
    expect(tours[0].showCount).toBe(3)
  })

  it('gap of exactly 5 days does NOT split', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-01' }),
      makeTrack({ show_date: '2023-07-06' }), // 5 day gap
    ]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(1)
  })

  it('gap of 6 days splits into two tours', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-01' }),
      makeTrack({ show_date: '2023-07-07' }), // 6 day gap
    ]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(2)
  })

  it('uses season labels', () => {
    const tracks = [
      makeTrack({ show_date: '2023-06-20' }),
      makeTrack({ show_date: '2023-06-21' }),
    ]
    const tours = identifyTours(tracks)
    expect(tours[0].tourLabel).toBe('Summer 2023')
  })

  it('disambiguates multiple tours in same season', () => {
    const tracks = [
      // Summer tour 1
      makeTrack({ show_date: '2023-06-01' }),
      makeTrack({ show_date: '2023-06-02' }),
      // Gap > 5
      // Summer tour 2
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2023-07-16' }),
    ]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(2)
    expect(tours[0].tourLabel).toBe('Summer 2023 (1)')
    expect(tours[1].tourLabel).toBe('Summer 2023 (2)')
  })

  it('generates unique tourIds', () => {
    const tracks = [
      makeTrack({ show_date: '2023-06-01' }),
      makeTrack({ show_date: '2023-07-15' }),
    ]
    const tours = identifyTours(tracks)
    expect(tours[0].tourId).not.toBe(tours[1].tourId)
  })

  it('deduplicates show dates from multiple tracks', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15', song_name: 'A' }),
      makeTrack({ show_date: '2023-07-15', song_name: 'B' }),
      makeTrack({ show_date: '2023-07-16', song_name: 'A' }),
    ]
    const tours = identifyTours(tracks)
    expect(tours).toHaveLength(1)
    expect(tours[0].showCount).toBe(2)
  })

  it('respects custom gap threshold', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-01' }),
      makeTrack({ show_date: '2023-07-04' }), // 3 day gap
    ]
    // With threshold 2, this should split
    const tours = identifyTours(tracks, 2)
    expect(tours).toHaveLength(2)
  })
})

describe('buildTourDateMap', () => {
  it('maps each show date to its tour', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15' }),
      makeTrack({ show_date: '2023-07-16' }),
    ]
    const tours = identifyTours(tracks)
    const map = buildTourDateMap(tours)

    expect(map.get('2023-07-15')).toBe(tours[0])
    expect(map.get('2023-07-16')).toBe(tours[0])
  })

  it('returns empty for no tours', () => {
    expect(buildTourDateMap([])).toEqual(new Map())
  })
})
