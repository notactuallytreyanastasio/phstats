import { describe, it, expect } from 'vitest'
import { formatDuration, groupShowsByYear, computeYearStats } from './transforms'
import type { Show, Track } from './types'

describe('formatDuration', () => {
  it('formats milliseconds into mm:ss', () => {
    expect(formatDuration(180000)).toBe('3:00')
  })

  it('pads seconds with leading zero', () => {
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats hour+ durations as h:mm:ss', () => {
    expect(formatDuration(3661000)).toBe('1:01:01')
  })

  it('handles sub-minute durations', () => {
    expect(formatDuration(45000)).toBe('0:45')
  })
})

const makeShow = (overrides: Partial<Show>): Show => ({
  id: 1,
  date: '2023-07-01',
  venue: 'MSG',
  city: 'New York',
  state: 'NY',
  setlistNotes: null,
  ...overrides,
})

describe('groupShowsByYear', () => {
  it('groups shows into year-keyed map', () => {
    const shows: Show[] = [
      makeShow({ id: 1, date: '2023-07-01' }),
      makeShow({ id: 2, date: '2023-08-15' }),
      makeShow({ id: 3, date: '2024-06-20' }),
    ]
    const result = groupShowsByYear(shows)
    expect(result.get(2023)?.length).toBe(2)
    expect(result.get(2024)?.length).toBe(1)
  })

  it('returns empty map for empty array', () => {
    expect(groupShowsByYear([]).size).toBe(0)
  })

  it('extracts year correctly from date string', () => {
    const shows = [makeShow({ date: '1997-12-31' })]
    const result = groupShowsByYear(shows)
    expect(result.has(1997)).toBe(true)
  })
})

const makeTrack = (overrides: Partial<Track>): Track => ({
  id: 1,
  title: 'Tweezer',
  position: 1,
  duration: 600000,
  setName: 'Set 1',
  showId: 1,
  showDate: '2023-07-01',
  ...overrides,
})

describe('computeYearStats', () => {
  it('computes stats for a year of shows and tracks', () => {
    const shows: Show[] = [
      makeShow({ id: 1, date: '2023-07-01', venue: 'MSG', state: 'NY' }),
      makeShow({ id: 2, date: '2023-08-15', venue: 'Dicks', state: 'CO' }),
    ]
    const tracks: Track[] = [
      makeTrack({ showId: 1, title: 'Tweezer', duration: 900000 }),
      makeTrack({ showId: 1, title: 'Fluffhead', duration: 600000 }),
      makeTrack({ showId: 2, title: 'Tweezer', duration: 1200000 }),
      makeTrack({ showId: 2, title: 'YEM', duration: 800000 }),
    ]
    const result = computeYearStats(2023, shows, tracks)
    expect(result.year).toBe(2023)
    expect(result.showCount).toBe(2)
    expect(result.uniqueVenues).toBe(2)
    expect(result.uniqueSongs).toBe(3) // Tweezer, Fluffhead, YEM
    expect(result.totalDuration).toBe(3500000)
    expect(result.statesVisited).toEqual(expect.arrayContaining(['NY', 'CO']))
    expect(result.statesVisited.length).toBe(2)
  })

  it('handles empty tracks gracefully', () => {
    const shows = [makeShow({ id: 1, date: '2023-07-01' })]
    const result = computeYearStats(2023, shows, [])
    expect(result.showCount).toBe(1)
    expect(result.totalDuration).toBe(0)
    expect(result.uniqueSongs).toBe(0)
  })

  it('deduplicates states', () => {
    const shows = [
      makeShow({ id: 1, date: '2023-07-01', state: 'NY' }),
      makeShow({ id: 2, date: '2023-07-02', state: 'NY' }),
    ]
    const result = computeYearStats(2023, shows, [])
    expect(result.statesVisited).toEqual(['NY'])
  })
})
