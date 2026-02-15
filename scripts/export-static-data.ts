/**
 * Export song_tracks from SQLite to a static JSON file for GH Pages.
 * Output: data/tracks.json (committed to repo, copied to public/data/ at build time)
 *
 * Usage: npx tsx scripts/export-static-data.ts
 */

import Database from 'better-sqlite3'
import { writeFileSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(import.meta.dirname, '..', 'data', 'phstats.db')
const OUT_PATH = join(import.meta.dirname, '..', 'data', 'tracks.json')

function main() {
  const db = new Database(DB_PATH, { readonly: true })

  const tracks = db.prepare(`
    SELECT song_name, show_date, set_name, position, duration_ms,
      likes, is_jamchart, jam_notes, venue, location, jam_url
    FROM song_tracks
    ORDER BY show_date, set_name, position
  `).all()

  db.close()

  writeFileSync(OUT_PATH, JSON.stringify(tracks))

  const sizeMB = (Buffer.byteLength(JSON.stringify(tracks)) / 1024 / 1024).toFixed(1)
  console.log(`Exported ${tracks.length} tracks to ${OUT_PATH} (${sizeMB}MB)`)
}

main()
