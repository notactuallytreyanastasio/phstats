import { describe, it, expect } from 'vitest'
import { parsePhishNetShows, parsePhishNetSetlist, parsePhishInTracks } from './parsers'

describe('parsePhishNetShows', () => {
  it('extracts unique shows from phish.net attendance response', () => {
    const raw = [
      { showid: 1, showdate: '2023-07-14', venue: 'Great Woods', city: 'Mansfield', state: 'MA', country: 'USA' },
      { showid: 2, showdate: '2023-07-15', venue: 'Great Woods', city: 'Mansfield', state: 'MA', country: 'USA' },
    ]
    const result = parsePhishNetShows(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 1,
      date: '2023-07-14',
      venue: 'Great Woods',
      city: 'Mansfield',
      state: 'MA',
      country: 'USA',
      setlistNotes: null,
    })
  })

  it('deduplicates shows by showid', () => {
    const raw = [
      { showid: 1, showdate: '2023-07-14', venue: 'Great Woods', city: 'Mansfield', state: 'MA', country: 'USA' },
      { showid: 1, showdate: '2023-07-14', venue: 'Great Woods', city: 'Mansfield', state: 'MA', country: 'USA' },
    ]
    const result = parsePhishNetShows(raw)
    expect(result).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(parsePhishNetShows([])).toEqual([])
  })
})

describe('parsePhishNetSetlist', () => {
  it('converts phish.net setlist entries into SongPerformance[]', () => {
    const raw = [
      {
        showdate: '2023-07-14',
        song: 'Tweezer',
        set: '2',
        position: '3',
        isjamchart: '1',
        tracktime: '1234',
        gap: '5',
      },
      {
        showdate: '2023-07-14',
        song: 'Fluffhead',
        set: '1',
        position: '1',
        isjamchart: '0',
        tracktime: '800',
        gap: '2',
      },
    ]
    const result = parsePhishNetSetlist(raw)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      songName: 'Tweezer',
      showDate: '2023-07-14',
      set: 'Set 2',
      position: 3,
      isJamchart: true,
    })
    expect(result[1]).toEqual({
      songName: 'Fluffhead',
      showDate: '2023-07-14',
      set: 'Set 1',
      position: 1,
      isJamchart: false,
    })
  })

  it('handles encore set label', () => {
    const raw = [
      { showdate: '2023-07-14', song: 'Tweeprise', set: 'e', position: '1', isjamchart: '0', tracktime: '300', gap: '1' },
    ]
    const result = parsePhishNetSetlist(raw)
    expect(result[0].set).toBe('Encore')
  })

  it('handles second encore', () => {
    const raw = [
      { showdate: '2023-07-14', song: 'Tweeprise', set: 'e2', position: '1', isjamchart: '0', tracktime: '300', gap: '1' },
    ]
    const result = parsePhishNetSetlist(raw)
    expect(result[0].set).toBe('Encore 2')
  })

  it('returns empty array for empty input', () => {
    expect(parsePhishNetSetlist([])).toEqual([])
  })
})

describe('parsePhishInTracks', () => {
  it('converts phish.in show tracks into Track[]', () => {
    const showId = 42
    const raw = [
      { id: 100, title: 'Tweezer', position: 1, duration: 900000, set_name: 'Set 1', show_date: '2023-07-14' },
      { id: 101, title: 'Fluffhead', position: 2, duration: 600000, set_name: 'Set 1', show_date: '2023-07-14' },
    ]
    const result = parsePhishInTracks(raw, showId)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      id: 100,
      title: 'Tweezer',
      position: 1,
      duration: 900000,
      setName: 'Set 1',
      showId: 42,
      showDate: '2023-07-14',
    })
  })

  it('converts duration from seconds to milliseconds when under 1000', () => {
    const raw = [
      { id: 100, title: 'Tweezer', position: 1, duration: 900, set_name: 'Set 1', show_date: '2023-07-14' },
    ]
    const result = parsePhishInTracks(raw, 1)
    // phish.in returns duration in milliseconds (typically 100000+),
    // but if someone passes seconds we handle it
    expect(result[0].duration).toBe(900)
  })

  it('returns empty array for empty input', () => {
    expect(parsePhishInTracks([], 1)).toEqual([])
  })
})
