import { describe, expect, it } from 'vitest'
import { BASELINE_ALLOCATION, DISTRICT_INCIDENCE, PROGRAMS, TOTAL_BUDGET } from './fixtures'

describe('Harbor City fixtures', () => {
  it('closes the baseline budget exactly', () => {
    expect(Object.values(BASELINE_ALLOCATION).reduce((sum, value) => sum + value, 0)).toBe(TOTAL_BUDGET)
  })

  it('keeps every baseline inside its statutory bounds', () => {
    for (const program of PROGRAMS) {
      expect(program.baseline).toBeGreaterThanOrEqual(program.minimum)
      expect(program.baseline).toBeLessThanOrEqual(program.maximum)
    }
  })

  it('normalizes every program incidence vector', () => {
    for (const incidence of Object.values(DISTRICT_INCIDENCE)) {
      expect(Object.values(incidence).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10)
    }
  })
})
