import { describe, it, expect } from 'vitest'
import { isHalloween, isNYE, isDicks, isFestival, isYEMSG, classifyShow, classifyRuns } from './run-classifier'
import type { TrackRow } from '../track-queries'

function makeTrack(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    song_name: 'Tweezer',
    show_date: '2023-07-15',
    set_name: 'Set 2',
    position: 3,
    duration_ms: 600000,
    likes: 10,
    is_jamchart: 0,
    jam_notes: '',
    venue: 'Saratoga PAC',
    location: 'Saratoga Springs, NY',
    ...overrides,
  }
}

describe('isHalloween', () => {
  it('detects Oct 31', () => {
    expect(isHalloween('2023-10-31')).toBe(true)
    expect(isHalloween('2014-10-31')).toBe(true)
  })

  it('rejects other dates', () => {
    expect(isHalloween('2023-10-30')).toBe(false)
    expect(isHalloween('2023-11-01')).toBe(false)
  })
})

describe('isNYE', () => {
  it('detects Dec 28-31', () => {
    expect(isNYE('2023-12-28')).toBe(true)
    expect(isNYE('2023-12-29')).toBe(true)
    expect(isNYE('2023-12-30')).toBe(true)
    expect(isNYE('2023-12-31')).toBe(true)
  })

  it('rejects other dates', () => {
    expect(isNYE('2023-12-27')).toBe(false)
    expect(isNYE('2024-01-01')).toBe(false)
  })
})

describe('isDicks', () => {
  it('detects Dick\'s Sporting Goods Park', () => {
    expect(isDicks("Dick's Sporting Goods Park")).toBe(true)
  })

  it('is case insensitive', () => {
    expect(isDicks("DICK'S SPORTING GOODS PARK")).toBe(true)
  })

  it('rejects other venues', () => {
    expect(isDicks('MSG')).toBe(false)
  })
})

describe('isFestival', () => {
  it('detects known festival venues', () => {
    expect(isFestival('Watkins Glen International')).toBe(true)
    expect(isFestival('Magnaball at Watkins Glen')).toBe(true)
  })

  it('rejects regular venues', () => {
    expect(isFestival('Madison Square Garden')).toBe(false)
  })
})

describe('isYEMSG', () => {
  it('detects MSG', () => {
    expect(isYEMSG('Madison Square Garden')).toBe(true)
  })

  it('rejects other venues', () => {
    expect(isYEMSG('The Garden')).toBe(false)
  })
})

describe('classifyShow', () => {
  it('prioritizes Halloween over NYE', () => {
    // Oct 31 at MSG — should be halloween, not yemsg
    expect(classifyShow('2023-10-31', 'Madison Square Garden')).toBe('halloween')
  })

  it('prioritizes NYE over YEMSG', () => {
    // Dec 30 at MSG — should be nye, not yemsg
    expect(classifyShow('2023-12-30', 'Madison Square Garden')).toBe('nye')
  })

  it('classifies Dick\'s', () => {
    expect(classifyShow('2023-09-01', "Dick's Sporting Goods Park")).toBe('dicks')
  })

  it('classifies YEMSG on non-special dates', () => {
    expect(classifyShow('2023-04-15', 'Madison Square Garden')).toBe('yemsg')
  })

  it('classifies festivals', () => {
    expect(classifyShow('2015-08-22', 'Watkins Glen International')).toBe('festival')
  })

  it('defaults to regular', () => {
    expect(classifyShow('2023-07-15', 'Saratoga PAC')).toBe('regular')
  })
})

describe('classifyRuns', () => {
  it('classifies all shows in track list', () => {
    const tracks = [
      makeTrack({ show_date: '2023-10-31', venue: 'Madison Square Garden' }),
      makeTrack({ show_date: '2023-12-30', venue: 'Madison Square Garden' }),
      makeTrack({ show_date: '2023-07-15', venue: 'Saratoga PAC' }),
    ]
    const runs = classifyRuns(tracks)
    expect(runs.get('2023-10-31')).toBe('halloween')
    expect(runs.get('2023-12-30')).toBe('nye')
    expect(runs.get('2023-07-15')).toBe('regular')
  })

  it('deduplicates by show_date', () => {
    const tracks = [
      makeTrack({ song_name: 'A', show_date: '2023-07-15', venue: 'Saratoga PAC' }),
      makeTrack({ song_name: 'B', show_date: '2023-07-15', venue: 'Saratoga PAC' }),
    ]
    const runs = classifyRuns(tracks)
    expect(runs.size).toBe(1)
  })

  it('returns empty map for no tracks', () => {
    expect(classifyRuns([]).size).toBe(0)
  })
})
