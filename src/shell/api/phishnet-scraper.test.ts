import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchUserShowsScrape, fetchSetlistScrape } from './phishnet-scraper'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const SHOWS_HTML = `
<html><body>
<table id="phish-shows">
  <thead><tr><th>Date</th><th>Info</th><th>Year</th><th>Venue</th><th>Location</th><th>Rating</th></tr></thead>
  <tbody>
    <tr>
      <td><a href="/setlists/phish-december-31-2024-msg-new-york-ny-usa.html">12/31/2024</a></td>
      <td></td>
      <td>2024</td>
      <td>MSG</td>
      <td>New York, NY, USA</td>
      <td>4.5</td>
    </tr>
  </tbody>
</table>
</body></html>
`

const SETLIST_HTML = `
<html><body>
<p><b>SET 1:</b> <a href="/song/tweezer">Tweezer</a></p>
<p><b>ENCORE:</b> <a href="/song/tweeprise">Tweezer Reprise</a></p>
</body></html>
`

describe('fetchUserShowsScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and scrapes user shows page', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => SHOWS_HTML,
    })

    const result = await fetchUserShowsScrape('someguyorwhatever')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://phish.net/user/someguyorwhatever/shows',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-12-31')
    expect(result[0].venue).toBe('MSG')
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })
    await expect(fetchUserShowsScrape('someone')).rejects.toThrow('Phish.net scrape error: 500')
  })
})

describe('fetchSetlistScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and scrapes setlist page', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => SETLIST_HTML,
    })

    const result = await fetchSetlistScrape('2024-12-31')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://phish.net/setlists?d=2024-12-31',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(result).toHaveLength(2)
    expect(result[0].songName).toBe('Tweezer')
    expect(result[1].songName).toBe('Tweezer Reprise')
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    await expect(fetchSetlistScrape('2024-12-31')).rejects.toThrow('Phish.net scrape error: 404')
  })
})
