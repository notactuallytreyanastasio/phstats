/**
 * Fetch detailed track history for a specific song from phish.in API.
 * Stores duration, likes, jamchart notes, venue info in song_tracks table.
 *
 * Usage: npx tsx scripts/fetch-song-history.ts [song-slug]
 * Default: what-s-going-through-your-mind
 */

import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SONG_SLUG = process.argv[2] || 'what-s-going-through-your-mind'
const DB_DIR = join(import.meta.dirname, '..', 'data')
const DB_PATH = join(DB_DIR, 'phstats.db')
const HEADERS = { Accept: 'application/json', 'User-Agent': 'phstats/1.0' }

function initDb(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true })
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS song_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_slug TEXT NOT NULL,
      song_name TEXT NOT NULL,
      show_date TEXT NOT NULL,
      set_name TEXT NOT NULL,
      position INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      is_jamchart INTEGER NOT NULL DEFAULT 0,
      jam_notes TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      UNIQUE(song_slug, show_date)
    );
    CREATE INDEX IF NOT EXISTS idx_song_tracks_slug ON song_tracks(song_slug);
    CREATE INDEX IF NOT EXISTS idx_song_tracks_date ON song_tracks(show_date);
  `)

  return db
}

async function fetchJson(url: string) {
  const resp = await fetch(url, { headers: HEADERS })
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${url}`)
  return resp.json()
}

async function main() {
  const db = initDb()

  // Get song info
  const songInfo = await fetchJson(`https://phish.in/api/v2/songs/${SONG_SLUG}`)
  const songName = songInfo.title
  console.log(`Song: ${songName} (${songInfo.tracks_count} tracks)`)

  // Get all show dates from 2024-08-07+ (song debut era)
  const showDates: string[] = []
  for (let page = 1; page <= 5; page++) {
    const data = await fetchJson(
      `https://phish.in/api/v2/shows?per_page=50&page=${page}&sort=date:desc`
    )
    const shows = data.shows || []
    for (const s of shows) {
      if (s.date >= '2024-08-07') showDates.push(s.date)
    }
    if (shows.length > 0 && shows[shows.length - 1].date < '2024-08-01') break
  }

  console.log(`Checking ${showDates.length} shows from 2024-08-07+...`)

  const insert = db.prepare(`
    INSERT OR REPLACE INTO song_tracks
      (song_slug, song_name, show_date, set_name, position, duration_ms, likes, is_jamchart, jam_notes, venue, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let found = 0
  for (const date of showDates.sort()) {
    const show = await fetchJson(`https://phish.in/api/v2/shows/${date}`)
    const tracks = show.tracks || []
    for (const t of tracks) {
      if (t.title?.toLowerCase().includes('going through your mind')) {
        const tags = Array.isArray(t.tags) ? t.tags : []
        const isJamchart = tags.some((tag: any) => tag?.name === 'Jamcharts') ? 1 : 0
        const jamNotes = tags.find((tag: any) => tag?.name === 'Jamcharts')?.notes || ''

        insert.run(
          SONG_SLUG, songName, date, t.set_name, t.position,
          t.duration, t.likes_count, isJamchart, jamNotes,
          t.venue_name || '', t.venue_location || ''
        )
        found++
        const durM = Math.floor(t.duration / 60000)
        const durS = Math.floor((t.duration % 60000) / 1000)
        const jc = isJamchart ? ' [JC]' : ''
        console.log(`  ${date}  ${durM}:${String(durS).padStart(2, '0')}${jc}  ${t.venue_name}`)
      }
    }
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nDone! ${found} tracks stored for "${songName}"`)
  db.close()
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
