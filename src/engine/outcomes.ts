import { BASELINE_ALLOCATION, BASELINE_OUTCOMES, COEFFICIENTS, DISTRICT_INCIDENCE } from '../model/fixtures'
import { DISTRICT_IDS, OUTCOME_IDS } from '../model/types'
import type { Allocation, CoefficientId, DistrictId, OutcomeId } from '../model/types'

export type OutcomeGrid = Record<DistrictId, Record<OutcomeId, number>>

export function calculateOutcomes(
  allocation: Allocation,
  suppressed: ReadonlySet<CoefficientId> = new Set(),
): OutcomeGrid {
  return Object.fromEntries(
    DISTRICT_IDS.map((districtId) => [
      districtId,
      Object.fromEntries(
        OUTCOME_IDS.map((outcomeId) => {
          const change = COEFFICIENTS.filter(
            (coefficient) => coefficient.outcomeId === outcomeId && !suppressed.has(coefficient.id),
          ).reduce((sum, coefficient) => {
            const deltaMillions = (allocation[coefficient.programId] - BASELINE_ALLOCATION[coefficient.programId]) / 10
            return sum + deltaMillions * DISTRICT_INCIDENCE[coefficient.programId][districtId] * coefficient.value
          }, 0)
          return [outcomeId, Math.min(100, Math.max(0, BASELINE_OUTCOMES[districtId][outcomeId] + change))]
        }),
      ) as Record<OutcomeId, number>,
    ]),
  ) as OutcomeGrid
}
