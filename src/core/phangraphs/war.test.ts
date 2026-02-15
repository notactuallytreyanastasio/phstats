import { describe, it, expect } from 'vitest'
import { percentile, computeReplacementLevels, computeWAR } from './war'
import type { PerformancePVS } from './types'

function makePVS(overrides: Partial<PerformancePVS> = {}): PerformancePVS {
  return {
    songName: 'Tweezer',
    showDate: '2023-07-15',
    pvs: 2.0,
    components: { lengthValue: 0.5, jamBonus: 1.0, bustoutValue: 0, setLeverage: 0, runLeverage: 0, rarityValue: 0.5 },
    ...overrides,
  }
}

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 20)).toBe(0)
  })

  it('returns value for single element', () => {
    expect(percentile([5], 20)).toBe(5)
  })

  it('computes 20th percentile', () => {
    // Sorted: [1, 2, 3, 4, 5]
    // 20th percentile: index = 0.2 * 4 = 0.8
    // Interpolation: 1 * 0.2 + 2 * 0.8 = 1.8
    expect(percentile([1, 2, 3, 4, 5], 20)).toBeCloseTo(1.8)
  })

  it('computes 50th percentile (median)', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3)
  })

  it('computes 0th percentile (min)', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1)
  })

  it('computes 100th percentile (max)', () => {
    expect(percentile([1, 2, 3], 100)).toBe(3)
  })
})

describe('computeReplacementLevels', () => {
  it('computes per-year 20th percentile', () => {
    const pvs = [
      makePVS({ showDate: '2023-01-01', pvs: 1.0 }),
      makePVS({ showDate: '2023-01-02', pvs: 2.0 }),
      makePVS({ showDate: '2023-01-03', pvs: 3.0 }),
      makePVS({ showDate: '2023-01-04', pvs: 4.0 }),
      makePVS({ showDate: '2023-01-05', pvs: 5.0 }),
    ]
    const levels = computeReplacementLevels(pvs)
    expect(levels.get(2023)).toBeCloseTo(1.8)
  })

  it('separates by year', () => {
    const pvs = [
      makePVS({ showDate: '2022-01-01', pvs: 1.0 }),
      makePVS({ showDate: '2023-01-01', pvs: 5.0 }),
    ]
    const levels = computeReplacementLevels(pvs)
    expect(levels.size).toBe(2)
  })
})

describe('computeWAR', () => {
  it('computes career WAR for a song', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 5.0 }),
      makePVS({ songName: 'A', showDate: '2023-01-02', pvs: 3.0 }),
    ]
    const levels = new Map([[2023, 2.0]])
    const war = computeWAR(pvs, levels)

    expect(war).toHaveLength(1)
    expect(war[0].songName).toBe('A')
    // (5-2) + (3-2) = 3 + 1 = 4
    expect(war[0].careerWAR).toBe(4)
  })

  it('allows negative WAR contributions', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 1.0 }),
    ]
    const levels = new Map([[2023, 2.0]])
    const war = computeWAR(pvs, levels)
    // 1.0 - 2.0 = -1.0
    expect(war[0].careerWAR).toBe(-1)
  })

  it('computes WAR per play', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 5.0 }),
      makePVS({ songName: 'A', showDate: '2023-01-02', pvs: 3.0 }),
    ]
    const levels = new Map([[2023, 2.0]])
    const war = computeWAR(pvs, levels)
    // careerWAR=4, plays=2, warPerPlay=2
    expect(war[0].warPerPlay).toBe(2)
  })

  it('computes WAR per show', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 5.0 }),
      makePVS({ songName: 'A', showDate: '2023-01-02', pvs: 3.0 }),
    ]
    const levels = new Map([[2023, 2.0]])
    const war = computeWAR(pvs, levels)
    // careerWAR=4, shows=2, warPerShow=2
    expect(war[0].warPerShow).toBe(2)
  })

  it('identifies peak WAR year', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2022-01-01', pvs: 3.0 }),
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 10.0 }),
    ]
    const levels = new Map([[2022, 1.0], [2023, 1.0]])
    const war = computeWAR(pvs, levels)
    expect(war[0].peakWARYear).toBe(2023)
  })

  it('builds warByYear record', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2022-01-01', pvs: 3.0 }),
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 5.0 }),
    ]
    const levels = new Map([[2022, 1.0], [2023, 2.0]])
    const war = computeWAR(pvs, levels)
    expect(war[0].warByYear[2022]).toBe(2) // 3-1
    expect(war[0].warByYear[2023]).toBe(3) // 5-2
  })

  it('handles multiple songs', () => {
    const pvs = [
      makePVS({ songName: 'A', showDate: '2023-01-01', pvs: 5.0 }),
      makePVS({ songName: 'B', showDate: '2023-01-01', pvs: 3.0 }),
    ]
    const levels = new Map([[2023, 2.0]])
    const war = computeWAR(pvs, levels)
    expect(war).toHaveLength(2)
  })

  it('returns empty for no PVS data', () => {
    expect(computeWAR([], new Map())).toEqual([])
  })
})
