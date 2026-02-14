import type { SongPerformance, Track, UserStats } from '../../core/types'
import type { PhishNetConfig } from './phishnet'
import { fetchUserShows, fetchSetlist } from './phishnet'
import { fetchShowTracks } from './phishin'
import { computeUserStats } from '../../core/transforms'

/**
 * Orchestrates all API calls to build complete UserStats.
 * Fetches shows from phish.net, then fetches setlists and tracks
 * for each show in parallel, and computes stats via pure transforms.
 */
export async function fetchUserStats(
  username: string,
  config: PhishNetConfig,
): Promise<UserStats> {
  const shows = await fetchUserShows(username, config)

  if (shows.length === 0) {
    return computeUserStats(username, [], [], [])
  }

  const showDates = shows.map(s => s.date)

  const [setlistResults, trackResults] = await Promise.all([
    Promise.all(showDates.map(date => fetchSetlist(date, config))),
    Promise.all(showDates.map(date => fetchShowTracks(date))),
  ])

  const performances: SongPerformance[] = setlistResults.flat()
  const tracks: Track[] = trackResults.flat()

  return computeUserStats(username, shows, performances, tracks)
}
