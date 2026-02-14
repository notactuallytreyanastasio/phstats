import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before vi.mock hoisting, so these are available in the mock factory
const { mockPageClose, mockContent, mockGoto, mockBrowserClose } = vi.hoisted(() => ({
  mockPageClose: vi.fn(),
  mockContent: vi.fn(),
  mockGoto: vi.fn(),
  mockBrowserClose: vi.fn(),
}))

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: mockGoto,
        content: mockContent,
        close: mockPageClose,
      }),
      close: mockBrowserClose,
    }),
  },
}))

import { fetchUserShowsScrape, fetchSetlistScrape } from './phishnet-scraper'

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

  it('launches browser, navigates, and scrapes user shows', async () => {
    mockGoto.mockResolvedValue(undefined)
    mockContent.mockResolvedValue(SHOWS_HTML)

    const result = await fetchUserShowsScrape('someguyorwhatever')

    expect(mockGoto).toHaveBeenCalledWith(
      'https://phish.net/user/someguyorwhatever/shows',
      { waitUntil: 'networkidle' },
    )
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2024-12-31')
    expect(result[0].venue).toBe('MSG')
    expect(mockPageClose).toHaveBeenCalled()
  })
})

describe('fetchSetlistScrape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('launches browser, navigates, and scrapes setlist', async () => {
    mockGoto.mockResolvedValue(undefined)
    mockContent.mockResolvedValue(SETLIST_HTML)

    const result = await fetchSetlistScrape('2024-12-31')

    expect(mockGoto).toHaveBeenCalledWith(
      'https://phish.net/setlists?d=2024-12-31',
      { waitUntil: 'networkidle' },
    )
    expect(result).toHaveLength(2)
    expect(result[0].songName).toBe('Tweezer')
    expect(result[1].songName).toBe('Tweezer Reprise')
    expect(mockPageClose).toHaveBeenCalled()
  })
})
