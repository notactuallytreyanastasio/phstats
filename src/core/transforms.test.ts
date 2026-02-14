import { describe, it, expect } from 'vitest'
import { formatDuration } from './transforms'

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
