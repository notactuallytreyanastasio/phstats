import { describe, it, expect } from 'vitest'
import { formatDuration, groupShowsByYear, computeYearStats, findBustouts, computeSongFrequency, getSetBreakdown, computeShowDurationRank, computeUserStats } from './transforms'
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

describe('computeSongFrequency', () => {
  it('counts how many times each song was played', () => {
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-02' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-08-01' }),
      makePerformance({ songName: 'YEM', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Fluffhead', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Fluffhead', showDate: '2023-07-02' }),
    ]
    const result = computeSongFrequency(performances)
    expect(result).toEqual([
      { songName: 'Tweezer', count: 3 },
      { songName: 'Fluffhead', count: 2 },
      { songName: 'YEM', count: 1 },
    ])
  })

  it('returns empty array for no performances', () => {
    expect(computeSongFrequency([])).toEqual([])
  })

  it('sorts by count descending then alphabetically', () => {
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Bathtub Gin' }),
      makePerformance({ songName: 'Antelope' }),
    ]
    const result = computeSongFrequency(performances)
    // Same count (1 each), alphabetical tiebreak
    expect(result[0].songName).toBe('Antelope')
    expect(result[1].songName).toBe('Bathtub Gin')
  })
})

describe('getSetBreakdown', () => {
  it('groups tracks by set name preserving position order', () => {
    const tracks: Track[] = [
      makeTrack({ title: 'Tweezer', setName: 'Set 1', position: 1 }),
      makeTrack({ title: 'Fluffhead', setName: 'Set 1', position: 2 }),
      makeTrack({ title: 'YEM', setName: 'Set 2', position: 1 }),
      makeTrack({ title: 'Harry Hood', setName: 'Encore', position: 1 }),
    ]
    const result = getSetBreakdown(tracks)
    expect(Object.keys(result)).toEqual(['Set 1', 'Set 2', 'Encore'])
    expect(result['Set 1'].map(t => t.title)).toEqual(['Tweezer', 'Fluffhead'])
    expect(result['Set 2'].map(t => t.title)).toEqual(['YEM'])
    expect(result['Encore'].map(t => t.title)).toEqual(['Harry Hood'])
  })

  it('returns empty object for no tracks', () => {
    expect(getSetBreakdown([])).toEqual({})
  })

  it('sorts tracks within each set by position', () => {
    const tracks: Track[] = [
      makeTrack({ title: 'B', setName: 'Set 1', position: 3 }),
      makeTrack({ title: 'A', setName: 'Set 1', position: 1 }),
      makeTrack({ title: 'C', setName: 'Set 1', position: 2 }),
    ]
    const result = getSetBreakdown(tracks)
    expect(result['Set 1'].map(t => t.title)).toEqual(['A', 'C', 'B'])
  })
})

describe('computeShowDurationRank', () => {
  it('ranks shows by total track duration descending', () => {
    const tracks: Track[] = [
      makeTrack({ showId: 1, showDate: '2023-07-01', duration: 500000 }),
      makeTrack({ showId: 1, showDate: '2023-07-01', duration: 300000 }),
      makeTrack({ showId: 2, showDate: '2023-08-15', duration: 1200000 }),
      makeTrack({ showId: 3, showDate: '2023-09-01', duration: 400000 }),
      makeTrack({ showId: 3, showDate: '2023-09-01', duration: 600000 }),
    ]
    const result = computeShowDurationRank(tracks)
    expect(result).toEqual([
      { showId: 2, showDate: '2023-08-15', totalDuration: 1200000, trackCount: 1 },
      { showId: 3, showDate: '2023-09-01', totalDuration: 1000000, trackCount: 2 },
      { showId: 1, showDate: '2023-07-01', totalDuration: 800000, trackCount: 2 },
    ])
  })

  it('returns empty array for no tracks', () => {
    expect(computeShowDurationRank([])).toEqual([])
  })
})

describe('computeUserStats', () => {
  it('computes comprehensive stats from shows, performances, and tracks', () => {
    const shows: Show[] = [
      makeShow({ id: 1, date: '2023-07-01', venue: 'MSG', city: 'New York', state: 'NY' }),
      makeShow({ id: 2, date: '2023-08-15', venue: 'Dicks', city: 'Commerce City', state: 'CO' }),
      makeShow({ id: 3, date: '2024-06-20', venue: 'MSG', city: 'New York', state: 'NY' }),
    ]
    const performances: SongPerformance[] = [
      makePerformance({ songName: 'Tweezer', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Fluffhead', showDate: '2023-07-01' }),
      makePerformance({ songName: 'Tweezer', showDate: '2023-08-15' }),
      makePerformance({ songName: 'YEM', showDate: '2023-08-15' }),
      makePerformance({ songName: 'Tweezer', showDate: '2024-06-20' }),
    ]
    const tracks: Track[] = [
      makeTrack({ showId: 1, showDate: '2023-07-01', title: 'Tweezer', duration: 900000 }),
      makeTrack({ showId: 1, showDate: '2023-07-01', title: 'Fluffhead', duration: 600000 }),
      makeTrack({ showId: 2, showDate: '2023-08-15', title: 'Tweezer', duration: 1200000 }),
      makeTrack({ showId: 2, showDate: '2023-08-15', title: 'YEM', duration: 800000 }),
      makeTrack({ showId: 3, showDate: '2024-06-20', title: 'Tweezer', duration: 1000000 }),
    ]

    const result = computeUserStats('someguyorwhatever', shows, performances, tracks)

    expect(result.username).toBe('someguyorwhatever')
    expect(result.totalShows).toBe(3)
    expect(result.totalSongs).toBe(5)
    expect(result.uniqueSongs).toBe(3) // Tweezer, Fluffhead, YEM
    expect(result.totalDuration).toBe(4500000)
    expect(result.yearStats).toHaveLength(2) // 2023 and 2024
    expect(result.yearStats[0].year).toBe(2023)
    expect(result.yearStats[0].showCount).toBe(2)
    expect(result.yearStats[1].year).toBe(2024)
    expect(result.yearStats[1].showCount).toBe(1)
    expect(result.topSongs[0]).toEqual({ songName: 'Tweezer', count: 3 })
    expect(result.statesVisited).toEqual(expect.arrayContaining(['NY', 'CO']))
    expect(result.venuesVisited).toEqual(expect.arrayContaining(['MSG', 'Dicks']))
    expect(result.firstShow).toBe('2023-07-01')
    expect(result.lastShow).toBe('2024-06-20')
  })

  it('handles empty data', () => {
    const result = computeUserStats('nobody', [], [], [])
    expect(result.totalShows).toBe(0)
    expect(result.totalSongs).toBe(0)
    expect(result.uniqueSongs).toBe(0)
    expect(result.totalDuration).toBe(0)
    expect(result.yearStats).toEqual([])
    expect(result.topSongs).toEqual([])
    expect(result.firstShow).toBeNull()
    expect(result.lastShow).toBeNull()
  })
})
