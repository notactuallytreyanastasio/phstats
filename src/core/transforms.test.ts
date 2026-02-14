import { describe, it, expect } from 'vitest'
import { formatDuration, groupShowsByYear, computeYearStats, findBustouts } from './transforms'
import type { Show, Track, SongPerformance } from './types'

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

const makePerformance = (overrides: Partial<SongPerformance>): SongPerformance => ({
  songName: 'Tweezer',
  showDate: '2023-07-01',
  set: 'Set 1',
  position: 1,
  ...overrides,
})

describe('findBustouts', () => {
  it('finds songs with gaps exceeding the threshold', () => {
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Harpua', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Harpua', showDate: '2023-07-15' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-02' }),
    ]
    // totalShows = 4, Harpua gap between its 2 appearances = the shows in between
    // With a threshold of 1 show gap, Harpua should be a bustout
    const result = findBustouts(performances, 5)
    expect(result.some(b => b.songName === 'Harpua')).toBe(true)
  })

  it('returns empty when no songs exceed threshold', () => {
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-02' }),
    ]
    const result = findBustouts(performances, 100)
    expect(result.length).toBe(0)
  })

  it('sorts bustouts by gap descending', () => {
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Harpua', showDate: '2010-01-01' }),
      makePerformance({ songName: 'Harpua', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Destiny Unbound', showDate: '2015-01-01' }),
      makePerformance({ songName: 'Destiny Unbound', showDate: '2023-07-01' }),
    ]
    const result = findBustouts(performances, 0)
    expect(result[0].songName).toBe('Harpua') // bigger gap
    expect(result[1].songName).toBe('Destiny Unbound')
  })
})
