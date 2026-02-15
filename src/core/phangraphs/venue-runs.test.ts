import { describe, it, expect } from 'vitest'
import { classifyVenueRuns } from './venue-runs'
import type { TrackRow } from '../track-queries'

function makeTrack(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    song_name: 'Tweezer',
    show_date: '2023-07-15',
    set_name: 'Set 1',
    position: 3,
    duration_ms: 600000,
    likes: 10,
    is_jamchart: 0,
    jam_notes: '',
    venue: 'MSG',
    location: 'New York, NY',
    ...overrides,
  }
}

describe('classifyVenueRuns', () => {
  it('returns empty for no tracks', () => {
    expect(classifyVenueRuns([])).toEqual(new Map())
  })

  it('single show is a run of 1', () => {
    const tracks = [makeTrack({ show_date: '2023-07-15', venue: 'MSG' })]
    const runs = classifyVenueRuns(tracks)
    expect(runs.size).toBe(1)
    const info = runs.get('2023-07-15')!
    expect(info.runLength).toBe(1)
    expect(info.positionInRun).toBe(1)
    expect(info.isOpener).toBe(true)
    expect(info.isCloser).toBe(true)
  })

  it('detects 3-night run at same venue', () => {
    const tracks = [
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-30', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-31', venue: 'MSG' }),
    ]
    const runs = classifyVenueRuns(tracks)
    expect(runs.size).toBe(3)

    expect(runs.get('2023-12-29')!.positionInRun).toBe(1)
    expect(runs.get('2023-12-29')!.isOpener).toBe(true)
    expect(runs.get('2023-12-29')!.isCloser).toBe(false)

    expect(runs.get('2023-12-30')!.positionInRun).toBe(2)
    expect(runs.get('2023-12-30')!.isOpener).toBe(false)
    expect(runs.get('2023-12-30')!.isCloser).toBe(false)

    expect(runs.get('2023-12-31')!.positionInRun).toBe(3)
    expect(runs.get('2023-12-31')!.isOpener).toBe(false)
    expect(runs.get('2023-12-31')!.isCloser).toBe(true)

    expect(runs.get('2023-12-31')!.runLength).toBe(3)
  })

  it('gap of a day breaks the run', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15', venue: 'MSG' }),
      // Gap: 2023-07-16 missing
      makeTrack({ show_date: '2023-07-17', venue: 'MSG' }),
    ]
    const runs = classifyVenueRuns(tracks)

    expect(runs.get('2023-07-15')!.runLength).toBe(1)
    expect(runs.get('2023-07-17')!.runLength).toBe(1)
  })

  it('different venues on consecutive days are separate runs', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15', venue: 'MSG' }),
      makeTrack({ show_date: '2023-07-16', venue: 'Red Rocks' }),
    ]
    const runs = classifyVenueRuns(tracks)

    expect(runs.get('2023-07-15')!.venue).toBe('MSG')
    expect(runs.get('2023-07-15')!.runLength).toBe(1)
    expect(runs.get('2023-07-16')!.venue).toBe('Red Rocks')
    expect(runs.get('2023-07-16')!.runLength).toBe(1)
  })

  it('handles multiple runs in sequence', () => {
    const tracks = [
      // 2-night at MSG
      makeTrack({ show_date: '2023-12-28', venue: 'MSG' }),
      makeTrack({ show_date: '2023-12-29', venue: 'MSG' }),
      // 3-night at Dicks (after a gap)
      makeTrack({ show_date: '2023-08-31', venue: "Dick's" }),
      makeTrack({ show_date: '2023-09-01', venue: "Dick's" }),
      makeTrack({ show_date: '2023-09-02', venue: "Dick's" }),
    ]
    const runs = classifyVenueRuns(tracks)

    expect(runs.get('2023-08-31')!.runLength).toBe(3)
    expect(runs.get('2023-08-31')!.positionInRun).toBe(1)
    expect(runs.get('2023-09-02')!.positionInRun).toBe(3)

    expect(runs.get('2023-12-28')!.runLength).toBe(2)
    expect(runs.get('2023-12-28')!.positionInRun).toBe(1)
    expect(runs.get('2023-12-29')!.positionInRun).toBe(2)
  })

  it('handles multiple tracks per show date (deduplicates)', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-15', venue: 'MSG', song_name: 'A' }),
      makeTrack({ show_date: '2023-07-15', venue: 'MSG', song_name: 'B' }),
      makeTrack({ show_date: '2023-07-16', venue: 'MSG', song_name: 'A' }),
    ]
    const runs = classifyVenueRuns(tracks)

    expect(runs.size).toBe(2)
    expect(runs.get('2023-07-15')!.runLength).toBe(2)
    expect(runs.get('2023-07-16')!.runLength).toBe(2)
  })

  it('handles 4-night run', () => {
    const tracks = [
      makeTrack({ show_date: '2023-07-30', venue: 'Red Rocks' }),
      makeTrack({ show_date: '2023-07-31', venue: 'Red Rocks' }),
      makeTrack({ show_date: '2023-08-01', venue: 'Red Rocks' }),
      makeTrack({ show_date: '2023-08-02', venue: 'Red Rocks' }),
    ]
    const runs = classifyVenueRuns(tracks)

    expect(runs.get('2023-07-30')!.runLength).toBe(4)
    expect(runs.get('2023-08-02')!.positionInRun).toBe(4)
    expect(runs.get('2023-08-02')!.isCloser).toBe(true)
  })
})
