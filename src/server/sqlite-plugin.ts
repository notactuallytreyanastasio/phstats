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

          if (req.url.startsWith('/api/users')) {
            const users = queryUsers(db)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(users))
          } else if (req.url.startsWith('/api/compare-songs')) {
            const usernames = url.searchParams.getAll('user')
            if (usernames.length < 2) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Need at least 2 user params' }))
              return
            }
            const data = queryCompareSongs(db, usernames)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/jamchart-years')) {
            const data = queryJamchartYears(db)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/jamchart-songs')) {
            const year = url.searchParams.get('year') || 'all'
            const data = queryJamchartSongs(db, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/jamchart-positions')) {
            const year = url.searchParams.get('year') || 'all'
            const data = queryJamchartPositions(db, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/show-heat')) {
            const year = url.searchParams.get('year') || 'all'
            const data = queryShowHeat(db, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/venue-stats')) {
            const year = url.searchParams.get('year') || 'all'
            const data = queryVenueStats(db, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/jam-evolution')) {
            const data = queryJamEvolution(db)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/song-pairings')) {
            const year = url.searchParams.get('year') || 'all'
            const min = parseInt(url.searchParams.get('min') || '3')
            const data = querySongPairings(db, year, min)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/song-list')) {
            const year = url.searchParams.get('year') || 'all'
            const data = querySongList(db, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/song-history')) {
            const song = url.searchParams.get('song') || url.searchParams.get('slug') || ''
            const year = url.searchParams.get('year') || 'all'
            const data = querySongHistory(db, song, year)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/all-shows')) {
            const data = queryAllShows(db)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(data))
          } else if (req.url.startsWith('/api/stats')) {
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

function queryUsers(db: Database.Database) {
  return db.prepare(`
    SELECT username, COUNT(*) as show_count FROM shows
    GROUP BY username ORDER BY username
  `).all()
}

function queryAllShows(db: Database.Database) {
  return db.prepare(`
    SELECT username, date, venue, city, state FROM shows
    ORDER BY date
  `).all()
}

function queryJamchartYears(db: Database.Database) {
  return db.prepare(`
    SELECT DISTINCT CAST(substr(show_date, 1, 4) AS INTEGER) as year
    FROM song_tracks
    ORDER BY year
  `).all().map((r: any) => r.year)
}

function queryJamchartSongs(db: Database.Database, year: string) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]
  return db.prepare(`
    SELECT song_name,
      COUNT(DISTINCT show_date) as total_shows,
      SUM(is_jamchart) as jamchart_count,
      ROUND(100.0 * SUM(is_jamchart) / COUNT(DISTINCT show_date), 1) as jamchart_pct
    FROM song_tracks
    ${where}
    GROUP BY song_name
    HAVING total_shows >= 2
    ORDER BY jamchart_count DESC
  `).all(...params)
}

function queryJamchartPositions(db: Database.Database, year: string) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]
  return db.prepare(`
    SELECT set_name as set_label, position,
      COUNT(*) as total,
      SUM(is_jamchart) as jamcharts
    FROM song_tracks
    ${where}
    GROUP BY set_name, position
    ORDER BY set_name, position
  `).all(...params)
}

function queryShowHeat(db: Database.Database, year: string) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]
  return db.prepare(`
    SELECT show_date,
      COUNT(*) as total_tracks,
      SUM(is_jamchart) as jamchart_count,
      SUM(duration_ms) as total_duration_ms,
      SUM(CASE WHEN is_jamchart THEN duration_ms ELSE 0 END) as jam_duration_ms,
      MAX(venue) as venue,
      MAX(location) as location
    FROM song_tracks
    ${where}
    GROUP BY show_date
    ORDER BY show_date
  `).all(...params)
}

function querySongList(db: Database.Database, year: string) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]
  return db.prepare(`
    SELECT song_name,
      COUNT(*) as times_played,
      SUM(is_jamchart) as jamchart_count,
      ROUND(100.0 * SUM(is_jamchart) / COUNT(*), 1) as jamchart_pct
    FROM song_tracks
    ${where}
    GROUP BY song_name
    ORDER BY jamchart_count DESC, times_played DESC
  `).all(...params)
}

function querySongHistory(db: Database.Database, songName: string, year: string) {
  const yearClause = year === 'all' ? '' : `AND substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [songName] : [songName, year]
  const tracks = db.prepare(`
    SELECT song_name, show_date, set_name, position, duration_ms,
      likes, is_jamchart, jam_notes, venue, location
    FROM song_tracks
    WHERE song_name = ? ${yearClause}
    ORDER BY show_date
  `).all(...params) as any[]

  return {
    song_name: tracks[0]?.song_name ?? songName,
    tracks: tracks.map(t => ({
      ...t,
      duration_min: t.duration_ms > 0 ? +(t.duration_ms / 60000).toFixed(1) : null,
    })),
  }
}

function queryVenueStats(db: Database.Database, year: string) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]
  return db.prepare(`
    SELECT venue, MAX(location) as location,
      COUNT(DISTINCT show_date) as total_shows,
      COUNT(*) as total_tracks,
      SUM(is_jamchart) as jamchart_count,
      ROUND(100.0 * SUM(is_jamchart) / COUNT(*), 1) as jamchart_pct,
      ROUND(AVG(duration_ms)) as avg_duration_ms
    FROM song_tracks
    ${where}
    GROUP BY venue
    ORDER BY jamchart_count DESC
  `).all(...params)
}

function queryJamEvolution(db: Database.Database) {
  const yearRows = db.prepare(`
    SELECT CAST(substr(show_date, 1, 4) AS INTEGER) as year,
      COUNT(DISTINCT show_date) as total_shows,
      COUNT(*) as total_tracks,
      SUM(is_jamchart) as jamchart_count,
      ROUND(1.0 * SUM(is_jamchart) / COUNT(DISTINCT show_date), 2) as jc_per_show,
      ROUND(AVG(duration_ms)) as avg_duration_ms,
      ROUND(AVG(CASE WHEN is_jamchart THEN duration_ms END)) as avg_jam_duration_ms
    FROM song_tracks
    GROUP BY year
    ORDER BY year
  `).all() as any[]

  // Detect new jam vehicles per year
  const firstYears = db.prepare(`
    SELECT song_name, MIN(CAST(substr(show_date, 1, 4) AS INTEGER)) as first_year
    FROM song_tracks
    WHERE is_jamchart = 1
    GROUP BY song_name
  `).all() as { song_name: string; first_year: number }[]

  const vehiclesByYear = new Map<number, string[]>()
  for (const { song_name, first_year } of firstYears) {
    const list = vehiclesByYear.get(first_year) || []
    list.push(song_name)
    vehiclesByYear.set(first_year, list)
  }

  return yearRows.map((r: any) => ({
    ...r,
    new_vehicles: (vehiclesByYear.get(r.year) || []).sort(),
  }))
}

function querySongPairings(db: Database.Database, year: string, minShows: number) {
  const where = year === 'all' ? '' : `WHERE substr(show_date, 1, 4) = ?`
  const params = year === 'all' ? [] : [year]

  // Get jammed songs per show
  const rows = db.prepare(`
    SELECT show_date, song_name
    FROM song_tracks
    ${where ? where + ' AND is_jamchart = 1' : 'WHERE is_jamchart = 1'}
    ORDER BY show_date, song_name
  `).all(...params) as { show_date: string; song_name: string }[]

  const showJams = new Map<string, string[]>()
  for (const { show_date, song_name } of rows) {
    const list = showJams.get(show_date) || []
    list.push(song_name)
    showJams.set(show_date, list)
  }

  const pairCounts = new Map<string, number>()
  for (const songs of showJams.values()) {
    if (songs.length < 2) continue
    for (let i = 0; i < songs.length; i++) {
      for (let j = i + 1; j < songs.length; j++) {
        const key = `${songs[i]}|||${songs[j]}`
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  }

  return [...pairCounts.entries()]
    .filter(([, count]) => count >= minShows)
    .map(([key, count]) => {
      const [a, b] = key.split('|||')
      return { song_a: a, song_b: b, co_occurrences: count }
    })
    .sort((a, b) => b.co_occurrences - a.co_occurrences)
}

function queryCompareSongs(db: Database.Database, usernames: string[]) {
  // For each user, get the set of songs they've seen (deduplicated per show)
  const userSongs = new Map<string, Map<string, number>>()

  for (const username of usernames) {
    const rows = db.prepare(`
      SELECT song_name, COUNT(DISTINCT show_date) as count
      FROM (
        SELECT p.song_name, p.show_date
        FROM performances p
        INNER JOIN shows s ON s.date = p.show_date AND s.username = ?
        GROUP BY p.song_name, p.show_date
      )
      GROUP BY song_name
    `).all(username) as { song_name: string; count: number }[]

    const songMap = new Map<string, number>()
    for (const row of rows) {
      songMap.set(row.song_name, row.count)
    }
    userSongs.set(username, songMap)
  }

  // Build a sorted list of all songs across all users
  const allSongs = new Set<string>()
  for (const songMap of userSongs.values()) {
    for (const song of songMap.keys()) {
      allSongs.add(song)
    }
  }
  const songs = [...allSongs].sort()

  // Build matrix: for each song, count per user
  const matrix = songs.map(song => {
    const counts: Record<string, number> = {}
    for (const username of usernames) {
      counts[username] = userSongs.get(username)?.get(song) ?? 0
    }
    return { song, ...counts }
  })

  return { usernames, songs, matrix }
}
