import { describe, it, expect } from 'vitest'
import { normalizeToJIS, computeJIS } from './jis'
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

describe('normalizeToJIS', () => {
  it('returns 0 for min PVS', () => {
    expect(normalizeToJIS(1.0, 1.0, 10.0)).toBe(0)
  })

  it('returns 10 for max PVS', () => {
    expect(normalizeToJIS(10.0, 1.0, 10.0)).toBe(10)
  })

  it('returns 5 for midpoint PVS', () => {
    expect(normalizeToJIS(5.5, 1.0, 10.0)).toBe(5)
  })

  it('returns 5 when all PVS are equal', () => {
    expect(normalizeToJIS(3.0, 3.0, 3.0)).toBe(5)
  })

  it('clamps to 0-10 range', () => {
    expect(normalizeToJIS(-5.0, 0, 10.0)).toBe(0)
    expect(normalizeToJIS(15.0, 0, 10.0)).toBe(10)
  })

  it('rounds to 2 decimal places', () => {
    // (3.33 - 0) / (10 - 0) * 10 = 3.33
    expect(normalizeToJIS(3.33, 0, 10.0)).toBe(3.33)
  })
})

describe('computeJIS', () => {
  it('returns empty for no PVS data', () => {
    expect(computeJIS([])).toEqual([])
  })

  it('computes avgJIS for single performance', () => {
    const pvs = [makePVS({ songName: 'A', pvs: 5.0 })]
    const jis = computeJIS(pvs)
    expect(jis).toHaveLength(1)
    expect(jis[0].songName).toBe('A')
    expect(jis[0].avgJIS).toBe(5) // single value, all same = 5
    expect(jis[0].peakJIS).toBe(5)
    expect(jis[0].jisVolatility).toBe(0)
  })

  it('computes avgJIS across multiple performances', () => {
    const pvs = [
      makePVS({ songName: 'A', pvs: 0.0 }),
      makePVS({ songName: 'A', pvs: 10.0 }),
    ]
    const jis = computeJIS(pvs)
    expect(jis).toHaveLength(1)
    // min=0, max=10 → JIS(0)=0, JIS(10)=10 → avg=5
    expect(jis[0].avgJIS).toBe(5)
    expect(jis[0].peakJIS).toBe(10)
  })

  it('computes jisVolatility (std dev)', () => {
    const pvs = [
      makePVS({ songName: 'A', pvs: 0.0 }),
      makePVS({ songName: 'A', pvs: 10.0 }),
    ]
    const jis = computeJIS(pvs)
    // JIS scores: [0, 10], avg=5, variance=25, stddev=5
    expect(jis[0].jisVolatility).toBe(5)
  })

  it('handles multiple songs', () => {
    const pvs = [
      makePVS({ songName: 'A', pvs: 1.0 }),
      makePVS({ songName: 'B', pvs: 5.0 }),
      makePVS({ songName: 'A', pvs: 9.0 }),
    ]
    const jis = computeJIS(pvs)
    expect(jis).toHaveLength(2)
    const a = jis.find(j => j.songName === 'A')!
    const b = jis.find(j => j.songName === 'B')!
    expect(a).toBeDefined()
    expect(b).toBeDefined()
  })

  it('normalizes across global PVS range', () => {
    // Song A has low PVS, Song B has high PVS
    // Global range: min=1, max=9
    const pvs = [
      makePVS({ songName: 'A', pvs: 1.0 }),
      makePVS({ songName: 'B', pvs: 9.0 }),
      makePVS({ songName: 'A', pvs: 5.0 }),
    ]
    const jis = computeJIS(pvs)
    const a = jis.find(j => j.songName === 'A')!
    const b = jis.find(j => j.songName === 'B')!
    // A: JIS(1)=0, JIS(5)=5 → avg=2.5, peak=5
    expect(a.avgJIS).toBe(2.5)
    expect(a.peakJIS).toBe(5)
    // B: JIS(9)=10 → avg=10, peak=10
    expect(b.avgJIS).toBe(10)
    expect(b.peakJIS).toBe(10)
  })

  it('rounds results to 2 decimal places', () => {
    const pvs = [
      makePVS({ songName: 'A', pvs: 1.0 }),
      makePVS({ songName: 'A', pvs: 2.0 }),
      makePVS({ songName: 'A', pvs: 10.0 }),
    ]
    const jis = computeJIS(pvs)
    // Global: min=1, max=10
    // JIS(1)=0, JIS(2)=1.11, JIS(10)=10
    // avg=(0+1.11+10)/3=3.703..., rounded to 3.7
    expect(jis[0].avgJIS).toBeCloseTo(3.7, 1)
  })
})
