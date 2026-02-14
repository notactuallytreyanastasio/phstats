/**
 * Scrape all user data from phish.net and store in SQLite.
 *
 * Usage: npx tsx scripts/scrape-to-sqlite.ts [username]
 *
 * Creates/updates data/phstats.db with shows and performances tables.
 */

import { chromium } from 'playwright'
import Database from 'better-sqlite3'
import { scrapeUserShows, scrapeSetlist } from '../src/core/scrapers'
import { mkdirSync } from 'fs'
import { join } from 'path'

const USERNAME = process.argv[2] || 'someguyorwhatever'
const DB_DIR = join(import.meta.dirname, '..', 'data')
const DB_PATH = join(DB_DIR, 'phstats.db')

function initDb(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS shows (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      date TEXT NOT NULL,
      venue TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      UNIQUE(username, date)
    );

    CREATE TABLE IF NOT EXISTS performances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      show_date TEXT NOT NULL,
      song_name TEXT NOT NULL,
      set_label TEXT NOT NULL,
      position INTEGER NOT NULL,
      is_jamchart INTEGER NOT NULL DEFAULT 0,
      UNIQUE(show_date, set_label, position)
    );

    CREATE INDEX IF NOT EXISTS idx_shows_username ON shows(username);
    CREATE INDEX IF NOT EXISTS idx_shows_date ON shows(date);
    CREATE INDEX IF NOT EXISTS idx_performances_date ON performances(show_date);
    CREATE INDEX IF NOT EXISTS idx_performances_song ON performances(song_name);
  `)

  return db
}

async function main() {
  const db = initDb()
  const browser = await chromium.launch({ headless: true })

  try {
    // Step 1: Scrape all shows
    console.log(`Fetching shows for ${USERNAME}...`)
    const page = await browser.newPage()
    await page.goto(`https://phish.net/user/${USERNAME}/shows`, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      const jq = (window as any).jQuery
      if (jq && jq('#phish-shows').DataTable) {
        jq('#phish-shows').DataTable().page.len(-1).draw()
      }
    })
    await page.waitForTimeout(500)
    const showsHtml = await page.content()
    await page.close()

    const shows = scrapeUserShows(showsHtml)
    console.log(`Found ${shows.length} shows`)

    // Insert shows
    const insertShow = db.prepare(`
      INSERT OR REPLACE INTO shows (id, username, date, venue, city, state)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const insertShows = db.transaction(() => {
      for (const show of shows) {
        insertShow.run(show.id, USERNAME, show.date, show.venue, show.city, show.state)
      }
    })
    insertShows()
    console.log(`Inserted ${shows.length} shows into DB`)

    // Step 2: Scrape setlists
    const insertPerf = db.prepare(`
      INSERT OR REPLACE INTO performances (show_date, song_name, set_label, position, is_jamchart)
      VALUES (?, ?, ?, ?, ?)
    `)

    // Check which dates we already have performances for
    const existingDates = new Set(
      db.prepare('SELECT DISTINCT show_date FROM performances').all()
        .map((r: any) => r.show_date)
    )

    const datesToScrape = shows
      .map(s => s.date)
      .filter(d => !existingDates.has(d))

    if (datesToScrape.length === 0) {
      console.log('All setlists already scraped.')
    } else {
      console.log(`Scraping setlists for ${datesToScrape.length} shows (${existingDates.size} already cached)...`)

      for (let i = 0; i < datesToScrape.length; i++) {
        const date = datesToScrape[i]
        const setlistPage = await browser.newPage()
        await setlistPage.goto(`https://phish.net/setlists?d=${date}`, { waitUntil: 'networkidle' })
        const setlistHtml = await setlistPage.content()
        await setlistPage.close()

        const songs = scrapeSetlist(setlistHtml, date)

        const insertBatch = db.transaction(() => {
          for (const song of songs) {
            insertPerf.run(date, song.songName, song.set, song.position, song.isJamchart ? 1 : 0)
          }
        })
        insertBatch()

        if ((i + 1) % 10 === 0 || i === datesToScrape.length - 1) {
          console.log(`  ${i + 1}/${datesToScrape.length} setlists scraped`)
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // Summary
    const showCount = db.prepare('SELECT COUNT(*) as n FROM shows WHERE username = ?').get(USERNAME) as any
    const perfCount = db.prepare('SELECT COUNT(*) as n FROM performances').get() as any
    const songCount = db.prepare('SELECT COUNT(DISTINCT song_name) as n FROM performances').get() as any

    console.log(`\nDone! DB at ${DB_PATH}`)
    console.log(`  ${showCount.n} shows`)
    console.log(`  ${perfCount.n} song performances`)
    console.log(`  ${songCount.n} unique songs`)
  } finally {
    await browser.close()
    db.close()
  }
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
