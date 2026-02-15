/**
 * Import PhishJustJams (PJJ) jam clip data from CSV into SQLite.
 * Creates normalized tables: pjj_jams, pjj_tags, pjj_jam_tags, pjj_song_map.
 * Only imports 2009+ data. Links to existing song_tracks via song name mapping.
 *
 * Usage: npx tsx scripts/import-pjj-jams.ts
 */

import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(import.meta.dirname, '..', 'data', 'phstats.db')
const CSV1_PATH = join(import.meta.dirname, '..', '..', '..', 'Downloads', 'PJJTrackList - Playlists 1.csv')
const CSV2_PATH = join(import.meta.dirname, '..', '..', '..', 'Downloads', 'PJJTrackList - Playlists 2.csv')
const BASE_URL = 'https://www.phishjustjams.com/'

/** PJJ abbreviation → song_tracks full name */
const SONG_NAME_MAP: Record<string, string> = {
  'Antelope': 'Run Like an Antelope',
  'Bowie': 'David Bowie',
  'Chalkdust': 'Chalk Dust Torture',
  'Crosseyed': 'Crosseyed and Painless',
  'Disease': 'Down with Disease',
  'Hood': 'Harry Hood',
  'Jibboo': 'Gotta Jibboo',
  'McGrupp': 'McGrupp and the Watchful Hosemasters',
  "Mike's": "Mike's Song",
  'Moma Dance': 'The Moma Dance',
  'Mull': 'Mull',
  "No Man's Land": 'No Men In No Man\'s Land',
  'Scents': 'Scents and Subtle Sounds',
  'Slave': 'Slave to the Traffic Light',
  "Sneakin Sally": "Sneakin' Sally Through the Alley",
  'Split': 'Split Open and Melt',
  'Squirming Coil': 'The Squirming Coil',
  'Stealing Time': 'Stealing Time From the Faulty Plan',
  'Theme': 'Theme From the Bottom',
  'The Birds': 'Birds of a Feather',
  'Timber': 'Timber (Jerry the Mule)',
  'Twenty Years Later': 'Twenty Years Later',
  'Weekapaug': 'Weekapaug Groove',
  "Wolfman's": "Wolfman's Brother",
  "What's the Use": "What's the Use?",
  "What's Going Through Your Mind": "What's Going Through Your Mind",
  'YEM': 'You Enjoy Myself',
  "Halley's": "Halley's Comet",
  'Roses': 'Roses Are Free',
  'Boogie On': 'Boogie On Reggae Woman',
  'Birds': 'Birds of a Feather',
  "Playin' in the Band": 'Playing in the Band',
  "Rock n' Roll": 'Rock and Roll',
  'Walls': 'Walls of the Cave',
  'Runaway Jim': 'Runaway Jim',
  'Limb': 'Limb by Limb',
  '2001': 'Also Sprach Zarathustra',
  'Caspian': 'Prince Caspian',
  'Chinese Water Torture': 'The Chinese Water Torture',
  'My Friend My Friend': 'My Friend, My Friend',
  'Number Line': 'Backwards Down the Number Line',
  'We Are Come To Outlive Our Brains': 'We Are Come to Outlive Our Brains',
}

interface CsvRow {
  url: string
  trackName: string
  date: string
  weekday: string
  city: string
  state: string
  venue: string
  band: string
  year: string
  tour: string
  duration: string
  tags: string[]
}

function parseCsv(path: string): { tagNames: string[]; rows: CsvRow[] } {
  const content = readFileSync(path, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const header = parseRow(lines[0])

  const urlIdx = header.indexOf('URL')
  const tagNames = header.slice(0, urlIdx)
  const coreNames = header.slice(urlIdx)

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i])
    if (cols.length < urlIdx + 3) continue

    const date = cols[urlIdx + 2] || ''
    if (date < '2009') continue

    const trackName = cols[urlIdx + 1] || ''

    const tagValues = cols.slice(0, urlIdx)
    const activeTags: string[] = []
    for (let t = 0; t < tagNames.length; t++) {
      const v = (tagValues[t] || '').trim().toLowerCase()
      if (v === 'x' || v === 'y' || v === 'jb') {
        activeTags.push(tagNames[t])
      }
    }

    rows.push({
      url: cols[urlIdx] || '',
      trackName,
      date,
      weekday: cols[urlIdx + 3] || '',
      city: cols[urlIdx + 4] || '',
      state: cols[urlIdx + 5] || '',
      venue: cols[urlIdx + 6] || '',
      band: cols[urlIdx + 7] || '',
      year: cols[urlIdx + 8] || '',
      tour: cols[urlIdx + 9] || '',
      duration: cols[urlIdx + 10] || '',
      tags: activeTags,
    })
  }
  return { tagNames, rows }
}

function parseRow(line: string): string[] {
  const cols: string[] = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      cols.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cols.push(cur)
  return cols
}

function parseDuration(d: string): number {
  const parts = d.split(':')
  if (parts.length !== 2) return 0
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}

function resolveFullName(pjjName: string): string {
  return SONG_NAME_MAP[pjjName] || pjjName
}

function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS pjj_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_name TEXT NOT NULL UNIQUE,
      source_file TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pjj_song_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pjj_name TEXT NOT NULL UNIQUE,
      song_name TEXT NOT NULL,
      song_slug TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pjj_jams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pjj_url TEXT NOT NULL,
      stream_url TEXT NOT NULL,
      song_map_id INTEGER NOT NULL REFERENCES pjj_song_map(id),
      show_date TEXT NOT NULL,
      weekday TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT '',
      venue TEXT NOT NULL DEFAULT '',
      year INTEGER NOT NULL,
      tour TEXT NOT NULL DEFAULT '',
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      UNIQUE(pjj_url)
    );
    CREATE INDEX IF NOT EXISTS idx_pjj_jams_date ON pjj_jams(show_date);
    CREATE INDEX IF NOT EXISTS idx_pjj_jams_song ON pjj_jams(song_map_id);

    CREATE TABLE IF NOT EXISTS pjj_jam_tags (
      jam_id INTEGER NOT NULL REFERENCES pjj_jams(id),
      tag_id INTEGER NOT NULL REFERENCES pjj_tags(id),
      PRIMARY KEY (jam_id, tag_id)
    );
  `)

  // Parse both CSVs
  console.log('Parsing CSV 1...')
  const csv1 = parseCsv(CSV1_PATH)
  console.log(`  ${csv1.rows.length} rows, ${csv1.tagNames.length} tag columns: ${csv1.tagNames.join(', ')}`)

  console.log('Parsing CSV 2...')
  const csv2 = parseCsv(CSV2_PATH)
  console.log(`  ${csv2.rows.length} rows, ${csv2.tagNames.length} tag columns: ${csv2.tagNames.join(', ')}`)

  // Merge tags from both files by URL key
  const mergedByUrl = new Map<string, CsvRow>()
  for (const row of csv1.rows) {
    mergedByUrl.set(row.url, { ...row })
  }
  for (const row of csv2.rows) {
    const existing = mergedByUrl.get(row.url)
    if (existing) {
      // Merge tags (deduplicate)
      const allTags = new Set([...existing.tags, ...row.tags])
      existing.tags = [...allTags]
    } else {
      mergedByUrl.set(row.url, { ...row })
    }
  }
  console.log(`\nMerged: ${mergedByUrl.size} unique jams (top 25 songs, 2009+)`)

  // Insert tags
  const allTagNames = new Set([...csv1.tagNames, ...csv2.tagNames])
  const insertTag = db.prepare('INSERT OR IGNORE INTO pjj_tags (tag_name, source_file) VALUES (?, ?)')
  for (const t of csv1.tagNames) insertTag.run(t, 'playlist1')
  for (const t of csv2.tagNames) insertTag.run(t, 'playlist2')
  console.log(`Tags: ${allTagNames.size} unique tag definitions`)

  // Build tag ID lookup
  const tagIdMap = new Map<string, number>()
  for (const row of db.prepare('SELECT id, tag_name FROM pjj_tags').all() as { id: number; tag_name: string }[]) {
    tagIdMap.set(row.tag_name, row.id)
  }

  // Look up existing song slugs from song_tracks
  const slugLookup = new Map<string, string>()
  for (const row of db.prepare('SELECT DISTINCT song_name, song_slug FROM song_tracks').all() as { song_name: string; song_slug: string }[]) {
    slugLookup.set(row.song_name, row.song_slug)
  }

  // Insert song mappings
  const insertSongMap = db.prepare('INSERT OR IGNORE INTO pjj_song_map (pjj_name, song_name, song_slug) VALUES (?, ?, ?)')
  const songMapIds = new Map<string, number>()
  const pjjNames = new Set([...mergedByUrl.values()].map(r => r.trackName))
  for (const pjj of pjjNames) {
    const fullName = resolveFullName(pjj)
    const slug = slugLookup.get(fullName) || ''
    insertSongMap.run(pjj, fullName, slug)
  }
  for (const row of db.prepare('SELECT id, pjj_name FROM pjj_song_map').all() as { id: number; pjj_name: string }[]) {
    songMapIds.set(row.pjj_name, row.id)
  }
  console.log(`Song mappings: ${songMapIds.size}`)

  // Insert jams + jam_tags
  const insertJam = db.prepare(`
    INSERT OR IGNORE INTO pjj_jams
      (pjj_url, stream_url, song_map_id, show_date, weekday, city, state, venue, year, tour, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertJamTag = db.prepare('INSERT OR IGNORE INTO pjj_jam_tags (jam_id, tag_id) VALUES (?, ?)')
  const getJamId = db.prepare('SELECT id FROM pjj_jams WHERE pjj_url = ?')

  let jamCount = 0
  let tagLinkCount = 0

  const insertAll = db.transaction(() => {
    for (const row of mergedByUrl.values()) {
      const songMapId = songMapIds.get(row.trackName)
      if (!songMapId) continue

      const streamUrl = BASE_URL + row.url
      const durationSec = parseDuration(row.duration)
      const yearNum = parseInt(row.year, 10) || parseInt(row.date.substring(0, 4), 10)

      insertJam.run(
        row.url, streamUrl, songMapId, row.date, row.weekday,
        row.city, row.state, row.venue, yearNum, row.tour, durationSec
      )
      jamCount++

      const jamRow = getJamId.get(row.url) as { id: number } | undefined
      if (jamRow && row.tags.length > 0) {
        for (const tag of row.tags) {
          const tagId = tagIdMap.get(tag)
          if (tagId) {
            insertJamTag.run(jamRow.id, tagId)
            tagLinkCount++
          }
        }
      }
    }
  })

  insertAll()
  console.log(`Inserted: ${jamCount} jams, ${tagLinkCount} tag links`)

  // Summary
  const stats = db.prepare('SELECT COUNT(*) as cnt FROM pjj_jams').get() as { cnt: number }
  const tagStats = db.prepare('SELECT COUNT(*) as cnt FROM pjj_jam_tags').get() as { cnt: number }
  const mapStats = db.prepare('SELECT COUNT(*) as cnt FROM pjj_song_map').get() as { cnt: number }
  console.log(`\nDatabase totals:`)
  console.log(`  pjj_jams: ${stats.cnt}`)
  console.log(`  pjj_jam_tags: ${tagStats.cnt}`)
  console.log(`  pjj_song_map: ${mapStats.cnt}`)
  console.log(`  pjj_tags: ${allTagNames.size}`)

  // Show per-song counts
  const perSong = db.prepare(`
    SELECT m.pjj_name, m.song_name, COUNT(j.id) as jam_count
    FROM pjj_song_map m
    JOIN pjj_jams j ON j.song_map_id = m.id
    GROUP BY m.id
    ORDER BY jam_count DESC
  `).all() as { pjj_name: string; song_name: string; jam_count: number }[]
  console.log(`\nPer-song jam counts:`)
  for (const s of perSong) {
    console.log(`  ${s.jam_count.toString().padStart(4)}  ${s.pjj_name.padEnd(25)} → ${s.song_name}`)
  }

  // Denormalize jam_url into song_tracks for direct access
  const cols = db.prepare("PRAGMA table_info(song_tracks)").all() as { name: string }[]
  if (!cols.some(c => c.name === 'jam_url')) {
    db.exec(`ALTER TABLE song_tracks ADD COLUMN jam_url TEXT NOT NULL DEFAULT ''`)
  } else {
    db.exec(`UPDATE song_tracks SET jam_url = '' WHERE jam_url != ''`)
  }
  const denormalized = db.prepare(`
    UPDATE song_tracks
    SET jam_url = (
      SELECT j.stream_url
      FROM pjj_jams j
      JOIN pjj_song_map m ON m.id = j.song_map_id
      WHERE m.song_name = song_tracks.song_name
        AND j.show_date = song_tracks.show_date
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1 FROM pjj_jams j
      JOIN pjj_song_map m ON m.id = j.song_map_id
      WHERE m.song_name = song_tracks.song_name
        AND j.show_date = song_tracks.show_date
    )
  `).run()
  console.log(`\nDenormalized: ${denormalized.changes} song_tracks rows got jam_url`)

  db.close()
}

main()
