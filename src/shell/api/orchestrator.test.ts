import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Show, SongPerformance, Track, UserStats } from '../../core/types'
import { fetchUserStats } from './orchestrator'

// Mock the API modules
vi.mock('./phishnet', () => ({
  fetchUserShows: vi.fn(),
  fetchSetlist: vi.fn(),
}))

vi.mock('./phishin', () => ({
  fetchShowTracks: vi.fn(),
}))

import { fetchUserShows, fetchSetlist } from './phishnet'
import { fetchShowTracks } from './phishin'

const mockFetchUserShows = vi.mocked(fetchUserShows)
const mockFetchSetlist = vi.mocked(fetchSetlist)
const mockFetchShowTracks = vi.mocked(fetchShowTracks)

const config = { apiKey: 'test-key' }

describe('fetchUserStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('orchestrates API calls and returns computed UserStats', async () => {
    const shows: Show[] = [
      { id: 1, date: '2023-07-01', venue: 'MSG', city: 'New York', state: 'NY', setlistNotes: null },
      { id: 2, date: '2023-08-15', venue: 'Dicks', city: 'Commerce City', state: 'CO', setlistNotes: null },
    ]

    const setlist1: SongPerformance[] = [
      { songName: 'Tweezer', showDate: '2023-07-01', set: 'Set 1', position: 1 },
      { songName: 'Fluffhead', showDate: '2023-07-01', set: 'Set 1', position: 2 },
    ]
    const setlist2: SongPerformance[] = [
      { songName: 'Tweezer', showDate: '2023-08-15', set: 'Set 1', position: 1 },
      { songName: 'YEM', showDate: '2023-08-15', set: 'Set 2', position: 1 },
    ]

    const tracks1: Track[] = [
      { id: 1, title: 'Tweezer', position: 1, duration: 900000, setName: 'Set 1', showId: 1, showDate: '2023-07-01' },
      { id: 2, title: 'Fluffhead', position: 2, duration: 600000, setName: 'Set 1', showId: 1, showDate: '2023-07-01' },
    ]
    const tracks2: Track[] = [
      { id: 3, title: 'Tweezer', position: 1, duration: 1200000, setName: 'Set 1', showId: 2, showDate: '2023-08-15' },
      { id: 4, title: 'YEM', position: 1, duration: 800000, setName: 'Set 2', showId: 2, showDate: '2023-08-15' },
    ]

    mockFetchUserShows.mockResolvedValue(shows)
    mockFetchSetlist.mockImplementation(async (date) => {
      if (date === '2023-07-01') return setlist1
      if (date === '2023-08-15') return setlist2
      return []
    })
    mockFetchShowTracks.mockImplementation(async (date) => {
      if (date === '2023-07-01') return tracks1
      if (date === '2023-08-15') return tracks2
      return []
    })

    const result = await fetchUserStats('someguyorwhatever', config)

    expect(result.username).toBe('someguyorwhatever')
    expect(result.totalShows).toBe(2)
    expect(result.totalSongs).toBe(4)
    expect(result.uniqueSongs).toBe(3)
    expect(result.totalDuration).toBe(3500000)
    expect(result.topSongs[0]).toEqual({ songName: 'Tweezer', count: 2 })
    expect(result.statesVisited).toEqual(expect.arrayContaining(['NY', 'CO']))
    expect(result.venuesVisited).toEqual(expect.arrayContaining(['MSG', 'Dicks']))
    expect(result.firstShow).toBe('2023-07-01')
    expect(result.lastShow).toBe('2023-08-15')

    // Verify API calls were made correctly
    expect(mockFetchUserShows).toHaveBeenCalledWith('someguyorwhatever', config)
    expect(mockFetchSetlist).toHaveBeenCalledTimes(2)
    expect(mockFetchShowTracks).toHaveBeenCalledTimes(2)
  })

  it('handles user with no shows', async () => {
    mockFetchUserShows.mockResolvedValue([])

    const result = await fetchUserStats('nobody', config)

    expect(result.totalShows).toBe(0)
    expect(result.totalSongs).toBe(0)
    expect(result.firstShow).toBeNull()
    expect(result.lastShow).toBeNull()
    expect(mockFetchSetlist).not.toHaveBeenCalled()
    expect(mockFetchShowTracks).not.toHaveBeenCalled()
  })

  it('handles phish.in returning empty tracks for a show', async () => {
    const shows: Show[] = [
      { id: 1, date: '2023-07-01', venue: 'MSG', city: 'New York', state: 'NY', setlistNotes: null },
    ]
    const setlist: SongPerformance[] = [
      { songName: 'Tweezer', showDate: '2023-07-01', set: 'Set 1', position: 1 },
    ]

    mockFetchUserShows.mockResolvedValue(shows)
    mockFetchSetlist.mockResolvedValue(setlist)
    mockFetchShowTracks.mockResolvedValue([]) // phish.in doesn't have this show

    const result = await fetchUserStats('someguyorwhatever', config)

    expect(result.totalShows).toBe(1)
    expect(result.totalSongs).toBe(1)
    expect(result.totalDuration).toBe(0) // no tracks = no duration
  })
})
