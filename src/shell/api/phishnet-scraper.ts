import { chromium, type Browser } from 'playwright'
import type { Show, SongPerformance } from '../../core/types'
import { scrapeUserShows, scrapeSetlist } from '../../core/scrapers'

const PHISHNET_BASE = 'https://phish.net'

let browserInstance: Browser | null = null

/**
 * Get or create a shared browser instance.
 * Reuses a single browser across calls for efficiency.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await chromium.launch({ headless: true })
  }
  return browserInstance
}

/**
 * Close the shared browser instance.
 * Call this when done scraping to clean up resources.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
}

/**
 * Fetch a page's fully-rendered HTML using Playwright.
 */
async function fetchRenderedHTML(url: string): Promise<string> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    return await page.content()
  } finally {
    await page.close()
  }
}

/**
 * Fetch and scrape user attendance from phish.net using Playwright.
 * Renders the page fully so DataTables JS populates the table.
 */
export async function fetchUserShowsScrape(username: string): Promise<Show[]> {
  const url = `${PHISHNET_BASE}/user/${encodeURIComponent(username)}/shows`
  const html = await fetchRenderedHTML(url)
  return scrapeUserShows(html)
}

/**
 * Fetch and scrape setlist for a show date from phish.net using Playwright.
 */
export async function fetchSetlistScrape(showDate: string): Promise<SongPerformance[]> {
  const url = `${PHISHNET_BASE}/setlists?d=${showDate}`
  const html = await fetchRenderedHTML(url)
  return scrapeSetlist(html, showDate)
}
