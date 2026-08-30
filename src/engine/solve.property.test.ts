import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { PROGRAMS, TOTAL_BUDGET } from '../model/fixtures'
import { PROGRAM_IDS } from '../model/types'
import { normalizeWeightVector, solveScenario } from './solve'

describe('solver invariants', () => {
  it('always closes feasible allocations on-grid and inside effective bounds', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })),
        fc.tuple(...PROGRAM_IDS.map(() => fc.boolean())),
        (values, held) => {
          const weights = normalizeWeightVector({ stability: values[0], mobility: values[1], safety: values[2], opportunity: values[3] })
          const protectedPrograms = PROGRAM_IDS.filter((_, index) => held[index])
          const result = solveScenario({ weights, protectedPrograms })
          expect(result.status).toBe('feasible')
          if (result.status !== 'feasible') return
          expect(PROGRAM_IDS.reduce((sum, id) => sum + result.allocation[id], 0)).toBe(TOTAL_BUDGET)
          for (const bound of result.bounds) {
            expect(Number.isSafeInteger(result.allocation[bound.programId])).toBe(true)
            expect(result.allocation[bound.programId]).toBeGreaterThanOrEqual(bound.lower)
            expect(result.allocation[bound.programId]).toBeLessThanOrEqual(bound.upper)
          }
        },
      ),
      { numRuns: 500 },
    )
  })

  it('fixture constraints still admit the baseline', () => {
    for (const program of PROGRAMS) expect(program.minimum).toBeLessThanOrEqual(program.baseline)
  })
})
