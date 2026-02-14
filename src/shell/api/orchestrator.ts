import type { SongPerformance, Track, UserStats } from '../../core/types'
import { fetchUserShowsScrape, fetchSetlistScrape, closeBrowser } from './phishnet-scraper'
import { fetchShowTracks } from './phishin'
import { computeUserStats } from '../../core/transforms'

/**
 * Orchestrates scraping + API calls to build complete UserStats.
 * Scrapes shows and setlists from phish.net via Playwright,
 * fetches tracks from phish.in API, and computes stats via pure transforms.
 */
export async function fetchUserStats(
  username: string,
): Promise<UserStats> {
  try {
    const shows = await fetchUserShowsScrape(username)

    if (shows.length === 0) {
      return computeUserStats(username, [], [], [])
    }

    const showDates = shows.map(s => s.date)

    const [setlistResults, trackResults] = await Promise.all([
      Promise.all(showDates.map(date => fetchSetlistScrape(date))),
      Promise.all(showDates.map(date => fetchShowTracks(date))),
    ])

    const performances: SongPerformance[] = setlistResults.flat()
    const tracks: Track[] = trackResults.flat()

    return computeUserStats(username, shows, performances, tracks)
  } finally {
    await closeBrowser()
  }
}
