import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useUserStats } from './useUserStats'
import type { UserStats } from '../../core/types'

vi.mock('../api/orchestrator', () => ({
  fetchUserStats: vi.fn(),
}))

import { fetchUserStats } from '../api/orchestrator'

const mockFetchUserStats = vi.mocked(fetchUserStats)

const config = { apiKey: 'test-key' }

const mockStats: UserStats = {
  username: 'someguyorwhatever',
  totalShows: 3,
  totalSongs: 10,
  uniqueSongs: 7,
  totalDuration: 5000000,
  yearStats: [],
  topSongs: [{ songName: 'Tweezer', count: 3 }],
  statesVisited: ['NY', 'CO'],
  venuesVisited: ['MSG', 'Dicks'],
  firstShow: '2023-07-01',
  lastShow: '2024-06-20',
}

describe('useUserStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts in loading state when username is provided', () => {
    mockFetchUserStats.mockReturnValue(new Promise(() => {})) // never resolves
    const { result } = renderHook(() => useUserStats('someguyorwhatever', config))
    expect(result.current.loading).toBe(true)
    expect(result.current.stats).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns stats after successful fetch', async () => {
    mockFetchUserStats.mockResolvedValue(mockStats)
    const { result } = renderHook(() => useUserStats('someguyorwhatever', config))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.stats).toEqual(mockStats)
    expect(result.current.error).toBeNull()
    expect(mockFetchUserStats).toHaveBeenCalledWith('someguyorwhatever', config)
  })

  it('returns error on fetch failure', async () => {
    mockFetchUserStats.mockRejectedValue(new Error('API down'))
    const { result } = renderHook(() => useUserStats('someguyorwhatever', config))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.stats).toBeNull()
    expect(result.current.error).toBe('API down')
  })

  it('does not fetch when username is empty', () => {
    const { result } = renderHook(() => useUserStats('', config))
    expect(result.current.loading).toBe(false)
    expect(result.current.stats).toBeNull()
    expect(mockFetchUserStats).not.toHaveBeenCalled()
  })
})
