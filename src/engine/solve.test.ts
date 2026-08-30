import { describe, expect, it } from 'vitest'
import { SIGNATURE_WEIGHTS, TOTAL_BUDGET } from '../model/fixtures'
import { solveScenario } from './solve'

describe('solveScenario', () => {
  it('reproduces the reviewed signature proposal', () => {
    const result = solveScenario({ weights: SIGNATURE_WEIGHTS, protectedPrograms: ['emergency'] })
    expect(result.status).toBe('feasible')
    if (result.status !== 'feasible') return
    expect(result.allocation).toEqual({
      housing: 195,
      transit: 182,
      emergency: 200,
      health: 77,
      youth: 98,
      climate: 56,
      libraries: 50,
      streets: 142,
    })
  })

  it('names the five binding request constraints and the $112.4M floor', () => {
    const result = solveScenario({
      weights: SIGNATURE_WEIGHTS,
      pins: { youth: 140, climate: 80, libraries: 70 },
      targets: { housing: { minimum: 280 }, transit: { minimum: 220 } },
    })
    expect(result.status).toBe('infeasible')
    if (result.status !== 'infeasible') return
    expect(result.requiredTotal).toBe(1_124)
    expect(result.availableTotal).toBe(TOTAL_BUDGET)
    expect(result.conflicts.map(({ programId, cause }) => [programId, cause])).toEqual([
      ['housing', 'target'],
      ['transit', 'target'],
      ['youth', 'pin'],
      ['climate', 'pin'],
      ['libraries', 'pin'],
    ])
  })

  it('recovers when hard targets are removed while preserving pins', () => {
    const result = solveScenario({
      weights: SIGNATURE_WEIGHTS,
      pins: { youth: 140, climate: 80, libraries: 70 },
    })
    expect(result.status).toBe('feasible')
    if (result.status !== 'feasible') return
    expect(result.allocation).toEqual({
      housing: 195,
      transit: 181,
      emergency: 180,
      health: 77,
      youth: 140,
      climate: 80,
      libraries: 70,
      streets: 77,
    })
  })

  it('rejects fractional internal money values', () => {
    expect(() => solveScenario({ weights: SIGNATURE_WEIGHTS, pins: { climate: 80.5 } })).toThrow(/integer/)
  })
})
