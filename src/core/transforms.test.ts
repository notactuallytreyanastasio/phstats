import { describe, it, expect } from 'vitest'
import { formatDuration, groupShowsByYear } from './transforms'
import type { Show } from './types'

describe('formatDuration', () => {
  it('formats milliseconds into mm:ss', () => {
    expect(formatDuration(180000)).toBe('3:00')
  })

  it('pads seconds with leading zero', () => {
    expect(formatDuration(65000)).toBe('1:05')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats hour+ durations as h:mm:ss', () => {
    expect(formatDuration(3661000)).toBe('1:01:01')
  })

  it('handles sub-minute durations', () => {
    expect(formatDuration(45000)).toBe('0:45')
  })
})

const makeShow = (overrides: Partial<Show>): Show => ({
  id: 1,
  date: '2023-07-01',
  venue: 'MSG',
  city: 'New York',
  state: 'NY',
  setlistNotes: null,
  ...overrides,
})

describe('groupShowsByYear', () => {
  it('groups shows into year-keyed map', () => {
    const shows: Show[] = [
      makeShow({ id: 1, date: '2023-07-01' }),
      makeShow({ id: 2, date: '2023-08-15' }),
      makeShow({ id: 3, date: '2024-06-20' }),
    ]
    const result = groupShowsByYear(shows)
    expect(result.get(2023)?.length).toBe(2)
    expect(result.get(2024)?.length).toBe(1)
  })

  it('returns empty map for empty array', () => {
    expect(groupShowsByYear([]).size).toBe(0)
  })

  it('extracts year correctly from date string', () => {
    const shows = [makeShow({ date: '1997-12-31' })]
    const result = groupShowsByYear(shows)
    expect(result.has(1997)).toBe(true)
  })
})
