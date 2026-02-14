import * as cheerio from 'cheerio'
import type { Show, SongPerformance } from './types'

/**
 * Parse "City, ST" into { city, state }.
 */
function parseLocation(location: string): { city: string; state: string } {
  const parts = location.split(',').map(s => s.trim())
  return {
    city: parts[0] ?? '',
    state: parts[1] ?? '',
  }
}

/**
 * Scrape user attendance from phish.net /user/{name}/shows HTML.
 * Pure function: HTML in, Show[] out.
 */
export function scrapeUserShows(html: string): Show[] {
  const $ = cheerio.load(html)
  const table = $('table#phish-shows tbody')
  if (table.length === 0) return []

  const shows: Show[] = []
  let idCounter = 1

  table.find('tr').each((_i, row) => {
    const cells = $(row).find('td')
    if (cells.length < 5) return

    const dateText = $(cells[0]).text().trim()
    const venue = $(cells[3]).text().trim()
    const locationText = $(cells[4]).text().trim()
    const { city, state } = parseLocation(locationText)

    shows.push({
      id: idCounter++,
      date: dateText,
      venue,
      city,
      state,
      setlistNotes: null,
    })
  })

  return shows
}

/**
 * Map raw set label text to our standard format.
 */
function normalizeSetLabel(raw: string): string {
  const cleaned = raw.replace(':', '').trim().toUpperCase()
  if (cleaned === 'ENCORE') return 'Encore'
  if (cleaned.startsWith('ENCORE')) return `Encore ${cleaned.slice(6).trim()}`
  if (cleaned.startsWith('SET')) return `Set ${cleaned.slice(3).trim()}`
  return cleaned
}

/**
 * Scrape setlist from a phish.net setlist page HTML.
 * Pure function: HTML + showDate in, SongPerformance[] out.
 */
export function scrapeSetlist(html: string, showDate: string): SongPerformance[] {
  const $ = cheerio.load(html)
  const performances: SongPerformance[] = []

  // Look for set groups - paragraphs containing bold set labels and song links
  $('p').each((_i, p) => {
    const bold = $(p).find('b').first()
    if (!bold.length) return

    const labelText = bold.text().trim()
    if (!labelText.match(/^(SET \d|ENCORE)/i)) return

    const setLabel = normalizeSetLabel(labelText)
    let position = 1

    $(p).find('a[href^="/song/"]').each((_j, link) => {
      performances.push({
        songName: $(link).text().trim(),
        showDate,
        set: setLabel,
        position: position++,
      })
    })
  })

  return performances
}
