import type { UserStats } from '../../core/types'
import type { PhishNetConfig } from '../api/phishnet'

interface UseUserStatsResult {
  stats: UserStats | null
  loading: boolean
  error: string | null
}

export function useUserStats(
  _username: string,
  _config: PhishNetConfig,
): UseUserStatsResult {
  throw new Error('Not implemented')
}
