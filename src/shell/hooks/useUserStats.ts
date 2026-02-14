import { useState, useEffect } from 'react'
import type { UserStats } from '../../core/types'
import { fetchUserStats as fetchStats } from '../api/orchestrator'

interface UseUserStatsResult {
  stats: UserStats | null
  loading: boolean
  error: string | null
}

export function useUserStats(username: string): UseUserStatsResult {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchStats(username)
      .then(result => {
        if (!cancelled) {
          setStats(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [username])

  return { stats, loading, error }
}
