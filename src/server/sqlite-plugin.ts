/**
 * Vite plugin that serves API routes from the SQLite database.
 * Reads from data/phstats.db and serves JSON responses.
 * Data appears live as the scraper writes to the DB.
 */

import type { Plugin } from 'vite'
import Database from 'better-sqlite3'
import { existsSync } from 'fs'
import { join } from 'path'

const DB_PATH = join(process.cwd(), 'data', 'phstats.db')

function getDb(): Database.Database | null {
  if (!existsSync(DB_PATH)) return null
  return new Database(DB_PATH, { readonly: true })
}

export function sqliteApiPlugin(): Plugin {
  return {
    name: 'sqlite-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        const db = getDb()
        if (!db) {
          res.writeHead(503, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Database not found. Run: npx tsx scripts/scrape-to-sqlite.ts' }))
          return
        }

        try {
          const url = new URL(req.url, 'http://localhost')
          const username = url.searchParams.get('username') || 'someguyorwhatever'

          if (req.url.startsWith('/api/stats')) {
            const stats = queryStats(db, username)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(stats))
          } else if (req.url.startsWith('/api/shows')) {
            const shows = queryShows(db, username)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(shows))
          } else if (req.url.startsWith('/api/top-songs')) {
            const songs = queryTopSongs(db, username)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(songs))
          } else if (req.url.startsWith('/api/year-stats')) {
            const years = queryYearStats(db, username)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(years))
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Not found' }))
          }
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        } finally {
          db.close()
        }
      })
    },
  }
}

function queryStats(db: Database.Database, username: string) {
  const showCount = db.prepare('SELECT COUNT(*) as n FROM shows WHERE username = ?').get(username) as any
  const perfCount = db.prepare(`
    SELECT COUNT(*) as n FROM performances p
    INNER JOIN shows s ON s.date = p.show_date AND s.username = ?
  `).get(username) as any
  const uniqueSongs = db.prepare(`
    SELECT COUNT(DISTINCT p.song_name) as n FROM performances p
    INNER JOIN shows s ON s.date = p.show_date AND s.username = ?
  `).get(username) as any
  const states = db.prepare('SELECT DISTINCT state FROM shows WHERE username = ? ORDER BY state').all(username) as any[]
  const venues = db.prepare('SELECT DISTINCT venue FROM shows WHERE username = ? ORDER BY venue').all(username) as any[]
  const dateRange = db.prepare('SELECT MIN(date) as first, MAX(date) as last FROM shows WHERE username = ?').get(username) as any

  return {
    username,
    totalShows: showCount.n,
    totalPerformances: perfCount.n,
    uniqueSongs: uniqueSongs.n,
    statesVisited: states.map((s: any) => s.state),
    venuesVisited: venues.map((v: any) => v.venue),
    firstShow: dateRange.first,
    lastShow: dateRange.last,
  }
}

function queryShows(db: Database.Database, username: string) {
  return db.prepare(`
    SELECT date, venue, city, state FROM shows
    WHERE username = ? ORDER BY date DESC
  `).all(username)
}

function queryTopSongs(db: Database.Database, username: string) {
  return db.prepare(`
    SELECT song_name, COUNT(*) as count,
      SUM(has_jamchart) as jamchart_count
    FROM (
      SELECT p.song_name, p.show_date, MAX(p.is_jamchart) as has_jamchart
      FROM performances p
      INNER JOIN shows s ON s.date = p.show_date AND s.username = ?
      GROUP BY p.song_name, p.show_date
    )
    GROUP BY song_name ORDER BY count DESC LIMIT 50
  `).all(username)
}

function queryYearStats(db: Database.Database, username: string) {
  return db.prepare(`
    SELECT
      CAST(substr(s.date, 1, 4) AS INTEGER) as year,
      COUNT(DISTINCT s.date) as show_count,
      COUNT(DISTINCT s.venue) as unique_venues,
      COUNT(DISTINCT p.song_name) as unique_songs
    FROM shows s
    LEFT JOIN performances p ON s.date = p.show_date
    WHERE s.username = ?
    GROUP BY year ORDER BY year
  `).all(username)
}
