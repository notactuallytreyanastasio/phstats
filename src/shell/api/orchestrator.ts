import type { UserStats } from '../../core/types'
import type { PhishNetConfig } from './phishnet'

export async function fetchUserStats(
  _username: string,
  _config: PhishNetConfig,
): Promise<UserStats> {
  throw new Error('Not implemented')
}
