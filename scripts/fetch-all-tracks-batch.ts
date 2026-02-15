/**
 * Fetch all track data from phish.in for a batch of show dates.
 * Designed to be run in parallel by multiple agents.
 *
 * Usage: npx tsx scripts/fetch-all-tracks-batch.ts <start_index> <end_index>
 *
 * Reads /tmp/phish30_dates.json for the full date list,
 * processes dates[start_index..end_index).
 * Skips shows already in the DB (checks by show_date).
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const START = parseInt(process.argv[2] || '0')
const END = parseInt(process.argv[3] || '999999')
const DB_PATH = join(import.meta.dirname, '..', 'data', 'phstats.db')
const HEADERS = { Accept: 'application/json', 'User-Agent': 'phstats/1.0' }

async function fetchJson(url: string): Promise<any> {
  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) throw new Error(`${resp.status}: ${url}`)
  return resp.json()
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const allDates: string[] = JSON.parse(readFileSync('/tmp/phish30_dates.json', 'utf-8'))
  const batch = allDates.slice(START, END)
  console.log(`Batch: indices ${START}-${END}, ${batch.length} shows (${batch[0]} to ${batch[batch.length - 1]})`)

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 10000')

  const insert = db.prepare(`
    INSERT OR IGNORE INTO song_tracks
      (song_slug, song_name, show_date, set_name, position, duration_ms, likes, is_jamchart, jam_notes, venue, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Check which dates are already fully scraped
  const existingDates = new Set(
    db.prepare('SELECT DISTINCT show_date FROM song_tracks').all()
      .map((r: any) => r.show_date)
  )

  const toScrape = batch.filter(d => !existingDates.has(d))
  console.log(`${existingDates.size} dates already in DB, ${toScrape.length} to scrape`)

  let totalInserted = 0
  let errors = 0

  for (let i = 0; i < toScrape.length; i++) {
    const date = toScrape[i]

    try {
      const show = await fetchJson(`https://phish.in/api/v2/shows/${date}`)
      const tracks = show.tracks || []

      const insertBatch = db.transaction(() => {
        for (const t of tracks) {
          const tags = Array.isArray(t.tags) ? t.tags : []
          const isJamchart = tags.some((tag: any) => tag?.name === 'Jamcharts') ? 1 : 0
          const jamNotes = tags.find((tag: any) => tag?.name === 'Jamcharts')?.notes || ''

          insert.run(
            t.slug || t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            t.title,
            date,
            t.set_name || '',
            t.position || 0,
            t.duration || 0,
            t.likes_count || 0,
            isJamchart,
            jamNotes,
            t.venue_name || '',
            t.venue_location || ''
          )
          totalInserted++
        }
      })
      insertBatch()

      if ((i + 1) % 10 === 0 || i === toScrape.length - 1) {
        console.log(`  ${i + 1}/${toScrape.length} shows (${date}) - ${tracks.length} tracks - total: ${totalInserted}`)
      }
    } catch (err) {
      errors++
      console.error(`  ERROR ${date}: ${err}`)
    }

    await sleep(120)
  }

  db.close()
  console.log(`\nDone! ${totalInserted} tracks inserted, ${errors} errors`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
