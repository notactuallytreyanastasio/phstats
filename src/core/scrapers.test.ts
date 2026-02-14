import { describe, it, expect } from 'vitest'
import { scrapeUserShows, scrapeSetlist } from './scrapers'

// Fixture HTML matching actual phish.net /user/{name}/shows table structure
// Real data uses YYYY-MM-DD dates and "City, ST" location (no country)
const SHOWS_HTML = `
<html><body>
<table id="phish-shows">
  <thead>
    <tr><th>Date</th><th>Info</th><th>Year</th><th>Venue</th><th>Location</th><th>Rating</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="/setlists/phish-december-31-2024-madison-square-garden-new-york-ny-usa.html">2024-12-31</a></td>
      <td><a href="/venue/157/Madison_Square_Garden">Madison Square GardenNew York, NY</a></td>
      <td>2024</td>
      <td><a href="/venue/157/Madison_Square_Garden">Madison Square Garden</a></td>
      <td><a href="/setlists/city/New_York/NY/USA">New York, NY</a></td>
      <td>4.536</td>
    </tr>
    <tr>
      <td><a href="/setlists/phish-august-31-2024-dicks-sporting-goods-park-commerce-city-co-usa.html">2024-08-31</a></td>
      <td><a href="/venue/763/Dicks_Sporting_Goods_Park">Dick's Sporting Goods ParkCommerce City, CO</a></td>
      <td>2024</td>
      <td><a href="/venue/763/Dicks_Sporting_Goods_Park">Dick's Sporting Goods Park</a></td>
      <td><a href="/setlists/city/Commerce_City/CO/USA">Commerce City, CO</a></td>
      <td>4.590</td>
    </tr>
    <tr>
      <td><a href="/setlists/phish-july-27-2014-merriweather-post-pavilion-columbia-md-usa.html">2014-07-27</a></td>
      <td><a href="/venue/43/Merriweather_Post_Pavilion">Merriweather Post PavilionColumbia, MD</a></td>
      <td>2014</td>
      <td><a href="/venue/43/Merriweather_Post_Pavilion">Merriweather Post Pavilion</a></td>
      <td><a href="/setlists/city/Columbia/MD/USA">Columbia, MD</a></td>
      <td>4.574</td>
    </tr>
  </tbody>
</table>
</body></html>
`

// Fixture HTML mimicking phish.net setlist page structure
const SETLIST_HTML = `
<html><body>
<div class="setlist-body">
  <p class="setlist-song-group">
    <b>SET 1:</b>
    <a href="/song/mikes-song">Mike's Song</a> &gt;
    <a href="/song/bouncing-around-the-room">Bouncing Around the Room</a>,
    <a href="/song/weekapaug-groove">Weekapaug Groove</a>
  </p>
  <p class="setlist-song-group">
    <b>SET 2:</b>
    <a href="/song/tweezer">Tweezer</a> -&gt;
    <a href="/song/also-sprach-zarathustra">Also Sprach Zarathustra</a>,
    <a href="/song/you-enjoy-myself">You Enjoy Myself</a>
  </p>
  <p class="setlist-song-group">
    <b>ENCORE:</b>
    <a href="/song/tweeprise">Tweezer Reprise</a>
  </p>
</div>
</body></html>
`

describe('scrapeUserShows', () => {
  it('extracts shows from the attendance table HTML', () => {
    const result = scrapeUserShows(SHOWS_HTML)
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      id: expect.any(Number),
      date: '2024-12-31',
      venue: 'Madison Square Garden',
      city: 'New York',
      state: 'NY',
      setlistNotes: null,
    })
  })

  it('preserves YYYY-MM-DD date format from page', () => {
    const result = scrapeUserShows(SHOWS_HTML)
    expect(result[0].date).toBe('2024-12-31')
    expect(result[1].date).toBe('2024-08-31')
    expect(result[2].date).toBe('2014-07-27')
  })

  it('splits location into city and state', () => {
    const result = scrapeUserShows(SHOWS_HTML)
    expect(result[0].city).toBe('New York')
    expect(result[0].state).toBe('NY')
    expect(result[1].city).toBe('Commerce City')
    expect(result[1].state).toBe('CO')
  })

  it('returns empty array for empty table', () => {
    const html = '<html><body><table id="phish-shows"><tbody></tbody></table></body></html>'
    expect(scrapeUserShows(html)).toEqual([])
  })

  it('returns empty array when table is missing', () => {
    expect(scrapeUserShows('<html><body></body></html>')).toEqual([])
  })
})

describe('scrapeSetlist', () => {
  it('extracts songs grouped by set', () => {
    const result = scrapeSetlist(SETLIST_HTML, '2024-12-31')
    expect(result.length).toBe(7)
  })

  it('assigns correct set labels', () => {
    const result = scrapeSetlist(SETLIST_HTML, '2024-12-31')
    const set1 = result.filter(s => s.set === 'Set 1')
    const set2 = result.filter(s => s.set === 'Set 2')
    const encore = result.filter(s => s.set === 'Encore')
    expect(set1).toHaveLength(3)
    expect(set2).toHaveLength(3)
    expect(encore).toHaveLength(1)
  })

  it('extracts song names correctly', () => {
    const result = scrapeSetlist(SETLIST_HTML, '2024-12-31')
    expect(result[0].songName).toBe("Mike's Song")
    expect(result[1].songName).toBe('Bouncing Around the Room')
    expect(result[6].songName).toBe('Tweezer Reprise')
  })

  it('assigns sequential positions within each set', () => {
    const result = scrapeSetlist(SETLIST_HTML, '2024-12-31')
    const set1 = result.filter(s => s.set === 'Set 1')
    expect(set1[0].position).toBe(1)
    expect(set1[1].position).toBe(2)
    expect(set1[2].position).toBe(3)
  })

  it('uses the provided show date', () => {
    const result = scrapeSetlist(SETLIST_HTML, '2024-12-31')
    expect(result.every(s => s.showDate === '2024-12-31')).toBe(true)
  })

  it('returns empty array for page with no setlist', () => {
    expect(scrapeSetlist('<html><body></body></html>', '2024-12-31')).toEqual([])
  })
})
