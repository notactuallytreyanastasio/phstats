/**
 * Scrape the final 10 shows of the 2025 Phish tour.
 * Uses Playwright to fetch from phish.net, cheerio to parse.
 *
 * Usage: npx tsx scripts/scrape-2025.ts
 */

import { chromium } from 'playwright'
import { scrapeUserShows, scrapeSetlist } from '../src/core/scrapers'

const USERNAME = 'someguyorwhatever'

async function main() {
  const browser = await chromium.launch({ headless: true })

  try {
    // Step 1: Get all shows for this user
    console.log(`Fetching shows for ${USERNAME}...`)
    const page = await browser.newPage()
    await page.goto(`https://phish.net/user/${USERNAME}/shows`, { waitUntil: 'networkidle' })
    const showsHtml = await page.content()
    await page.close()

    const allShows = scrapeUserShows(showsHtml)
    console.log(`Found ${allShows.length} total shows`)

    // Step 2: Filter to 2025, sort by date, take final 10
    const shows2025 = allShows
      .filter(s => s.date.startsWith('2025'))
      .sort((a, b) => a.date.localeCompare(b.date))

    console.log(`Found ${shows2025.length} shows in 2025`)

    const final10 = shows2025.slice(-10)
    console.log(`\nFinal 10 shows of 2025 tour:`)
    for (const show of final10) {
      console.log(`  ${show.date} — ${show.venue}, ${show.city}, ${show.state}`)
    }

    // Step 3: Scrape setlists for each of the final 10
    console.log(`\n--- Scraping setlists ---\n`)

    for (const show of final10) {
      console.log(`\n========================================`)
      console.log(`${show.date} — ${show.venue}, ${show.city}, ${show.state}`)
      console.log(`========================================`)

      const setlistPage = await browser.newPage()
      await setlistPage.goto(`https://phish.net/setlists?d=${show.date}`, { waitUntil: 'networkidle' })
      const setlistHtml = await setlistPage.content()
      await setlistPage.close()

      const songs = scrapeSetlist(setlistHtml, show.date)

      if (songs.length === 0) {
        console.log('  (no setlist data found)')
        continue
      }

      // Group by set
      const sets = new Map<string, typeof songs>()
      for (const song of songs) {
        const existing = sets.get(song.set)
        if (existing) {
          existing.push(song)
        } else {
          sets.set(song.set, [song])
        }
      }

      for (const [setName, setSongs] of sets) {
        console.log(`\n  ${setName}:`)
        for (const song of setSongs) {
          const jamchart = song.isJamchart ? ' ★' : ''
          console.log(`    ${song.position}. ${song.songName}${jamchart}`)
        }
      }

      console.log(`\n  Total songs: ${songs.length}`)

      // Be respectful — small delay between requests
      await new Promise(r => setTimeout(r, 1000))
    }
  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
