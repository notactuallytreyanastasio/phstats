import { describe, it, expect } from 'vitest'
import { tourFromDate, weekdayFromDate } from './date-utils'

describe('tourFromDate', () => {
  it('returns Winter for January', () => {
    expect(tourFromDate('2023-01-15')).toBe('Winter')
  })

  it('returns Winter for February', () => {
    expect(tourFromDate('2024-02-20')).toBe('Winter')
  })

  it('returns Winter for March', () => {
    expect(tourFromDate('2023-03-10')).toBe('Winter')
  })

  it('returns Spring for April', () => {
    expect(tourFromDate('2023-04-15')).toBe('Spring')
  })

  it('returns Spring for May', () => {
    expect(tourFromDate('2023-05-28')).toBe('Spring')
  })

  it('returns Summer for June', () => {
    expect(tourFromDate('2023-06-01')).toBe('Summer')
  })

  it('returns Summer for July', () => {
    expect(tourFromDate('1997-07-04')).toBe('Summer')
  })

  it('returns Summer for August', () => {
    expect(tourFromDate('2023-08-31')).toBe('Summer')
  })

  it('returns Fall for September', () => {
    expect(tourFromDate('2023-09-01')).toBe('Fall')
  })

  it('returns Fall for October', () => {
    expect(tourFromDate('2023-10-31')).toBe('Fall')
  })

  it('returns Fall for November', () => {
    expect(tourFromDate('2023-11-15')).toBe('Fall')
  })

  it('returns Holiday for December', () => {
    expect(tourFromDate('2023-12-28')).toBe('Holiday')
  })

  it('returns Holiday for early December', () => {
    expect(tourFromDate('2023-12-01')).toBe('Holiday')
  })
})

describe('weekdayFromDate', () => {
  it('returns correct day for a known Monday', () => {
    expect(weekdayFromDate('2023-07-03')).toBe('Monday')
  })

  it('returns correct day for a known Friday', () => {
    expect(weekdayFromDate('2023-12-29')).toBe('Friday')
  })

  it('returns correct day for a known Saturday', () => {
    expect(weekdayFromDate('2023-12-30')).toBe('Saturday')
  })

  it('returns correct day for a known Sunday', () => {
    expect(weekdayFromDate('2023-12-31')).toBe('Sunday')
  })

  it('returns correct day for a known Wednesday', () => {
    expect(weekdayFromDate('1993-02-03')).toBe('Wednesday')
  })

  it('returns correct day for a known Thursday', () => {
    expect(weekdayFromDate('1997-11-13')).toBe('Thursday')
  })

  it('returns correct day for a known Tuesday', () => {
    expect(weekdayFromDate('2024-01-02')).toBe('Tuesday')
  })
})
