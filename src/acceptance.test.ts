/**
 * PRD section 20 acceptance criteria that can be settled deterministically.
 *
 * The engine is pure, so a criterion phrased as "in five out of five runs" is proven by one run plus
 * determinism. Criteria that need a deployed origin, a live agent, or a human observer are not here;
 * `IMPLEMENTATION_PLAN.md` tracks those.
 */
import { describe, expect, it } from 'vitest'
import { solveScenario } from './engine/solve'
import { BASELINE_ALLOCATION, SIGNATURE_WEIGHTS, TOTAL_BUDGET } from './model/fixtures'
import { civicReducer, createInitialState } from './state/civicState'
import { activityCounts, changeList } from './state/summaries'
import { PROGRAM_IDS } from './model/types'

const signatureRequest = { weights: SIGNATURE_WEIGHTS, protectedPrograms: ['emergency'] as const }

describe('PRD 20 acceptance', () => {
  it('the signature prompt produces a feasible scenario that moves housing and transit up, every run', () => {
    const runs = Array.from({ length: 5 }, () => solveScenario({ ...signatureRequest }))

    for (const run of runs) {
      expect(run.status).toBe('feasible')
      if (run.status !== 'feasible') return
      expect(run.allocation.housing).toBeGreaterThan(BASELINE_ALLOCATION.housing)
      expect(run.allocation.transit).toBeGreaterThan(BASELINE_ALLOCATION.transit)
      expect(run.allocation.emergency).toBe(BASELINE_ALLOCATION.emergency)
      expect(PROGRAM_IDS.reduce((sum, id) => sum + run.allocation[id], 0)).toBe(TOTAL_BUDGET)
    }
    expect(new Set(runs.map((run) => JSON.stringify(run))).size).toBe(1)
  })

  it('pinning Climate and Parks causes a visibly different revision', () => {
    const unpinned = solveScenario({ ...signatureRequest })
    const pinned = solveScenario({ ...signatureRequest, pins: { climate: BASELINE_ALLOCATION.climate } })
    if (unpinned.status !== 'feasible' || pinned.status !== 'feasible') throw new Error('both must be feasible')

    expect(pinned.allocation.climate).toBe(BASELINE_ALLOCATION.climate)
    expect(unpinned.allocation.climate).toBeLessThan(BASELINE_ALLOCATION.climate)
    // "Visibly different" means more than the pinned row itself moved: the money had to come from elsewhere.
    const elsewhere = PROGRAM_IDS.filter((id) => id !== 'climate' && unpinned.allocation[id] !== pinned.allocation[id])
    expect(elsewhere.length).toBeGreaterThan(0)
    expect(changeList(unpinned.allocation, pinned.allocation).length).toBeGreaterThan(1)
  })

  it('the activity log distinguishes read, staged, discarded, and human-accepted actions', () => {
    const meta = (actor: 'human' | 'tool', action: string) => ({ actor, action, summary: `${action} ran` })
    const scenario = { intent: { name: 'Signature', rationale: 'weights', request: signatureRequest }, result: solveScenario({ ...signatureRequest }) }

    let state = civicReducer(createInitialState(), { type: 'focus', focus: { programs: ['housing'], districts: [], outcomes: [] }, meta: meta('tool', 'focus_tradeoffs') })
    state = civicReducer(state, { type: 'stage', scenario, meta: meta('tool', 'preview_scenario') })
    state = civicReducer(state, { type: 'discard', meta: meta('tool', 'discard_preview') })
    state = civicReducer(state, { type: 'stage', scenario, meta: meta('tool', 'revise_scenario') })
    state = civicReducer(state, { type: 'accept', id: 'accepted-1', meta: meta('human', 'accept') })

    expect(state.activity.map((entry) => `${entry.actor}:${entry.action}`)).toEqual([
      'tool:focus_tradeoffs',
      'tool:preview_scenario',
      'tool:discard_preview',
      'tool:revise_scenario',
      'human:accept',
    ])
    expect(activityCounts(state)).toEqual({ toolCalls: 4, humanDecisions: 1 })

    // Only the human action produced a receipt, and only it changed the canonical allocation.
    expect(state.accepted).toHaveLength(1)
    expect(state.accepted[0]!.from).toEqual(BASELINE_ALLOCATION)
    expect(state.canonical).not.toEqual(BASELINE_ALLOCATION)
    // Activity order remains monotonic while each entry records the state version it observed or produced.
    expect(state.activity.map((entry) => entry.id)).toEqual([1, 2, 3, 4, 5])
    expect(state.activity.map((entry) => entry.stateVersion)).toEqual([2, 3, 4, 5, 6])
  })
})
