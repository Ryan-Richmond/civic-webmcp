import { describe, expect, it } from 'vitest'
import { BASELINE_ALLOCATION, BASELINE_OUTCOMES } from '../model/fixtures'
import { calculateOutcomes } from './outcomes'

describe('calculateOutcomes', () => {
  it('returns the exact baseline grid for the baseline allocation', () => {
    expect(calculateOutcomes(BASELINE_ALLOCATION)).toEqual(BASELINE_OUTCOMES)
  })

  it('treats coefficient suppression as a derived-state mask', () => {
    const changed = { ...BASELINE_ALLOCATION, housing: 160, streets: 100 }
    const normal = calculateOutcomes(changed)
    const suppressed = calculateOutcomes(changed, new Set(['cf_housing_stability']))
    expect(normal.river_ward.stability).toBeGreaterThan(BASELINE_OUTCOMES.river_ward.stability)
    expect(suppressed.river_ward.stability).toBe(BASELINE_OUTCOMES.river_ward.stability)
    expect(suppressed.river_ward.mobility).toBeLessThan(BASELINE_OUTCOMES.river_ward.mobility)
  })
})
