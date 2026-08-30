import { describe, expect, it } from 'vitest'
import { SIGNATURE_WEIGHTS } from '../model/fixtures'
import type { Pins } from '../model/types'
import { solveScenario } from '../engine/solve'
import {
  canonicalAllocation,
  civicReducer,
  createInitialState,
  restorePersistentState,
  serializePersistentState,
} from './civicState'

const toolMeta = { actor: 'tool' as const, action: 'preview_scenario', summary: 'staged a proposal' }

function stagedScenario(pins: Pins = {}) {
  const request = { weights: SIGNATURE_WEIGHTS, pins }
  return { intent: { name: 'Housing and access', rationale: 'signature', request }, result: solveScenario(request) }
}

describe('civicReducer', () => {
  it('keeps staged state separate from the canonical allocation', () => {
    const initial = createInitialState()
    const staged = civicReducer(initial, { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    expect(canonicalAllocation(staged)).toEqual(initial.canonical)
    expect(staged.staged).not.toBeNull()
    expect(staged.stateVersion).toBe(initial.stateVersion + 1)
  })

  it('preserves pins through revision and acceptance', () => {
    let state = createInitialState()
    state = civicReducer(state, { type: 'pin', programId: 'climate', value: 80, meta: { actor: 'human', action: 'pin', summary: 'pinned climate' } })
    state = civicReducer(state, { type: 'stage', scenario: stagedScenario(state.pins), meta: toolMeta })
    state = civicReducer(state, { type: 'stage', scenario: stagedScenario(state.pins), meta: { ...toolMeta, action: 'revise_scenario' } })
    state = civicReducer(state, { type: 'accept', id: 'scenario-1', meta: { actor: 'human', action: 'accept', summary: 'accepted proposal' } })
    expect(state.pins).toEqual({ climate: 80 })
    expect(state.accepted).toHaveLength(1)
    expect(state.staged).toBeNull()
  })

  it('clears suppression on discard and accept without mutating coefficients', () => {
    let state = civicReducer(createInitialState(), { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    state = civicReducer(state, { type: 'setSuppression', coefficientId: 'cf_housing_stability', suppressed: true, meta: { actor: 'tool', action: 'test_assumption', summary: 'suppressed coefficient' } })
    expect(state.suppressedCoefficients).toEqual(['cf_housing_stability'])
    state = civicReducer(state, { type: 'discard', meta: { actor: 'tool', action: 'discard_preview', summary: 'discarded proposal' } })
    expect(state.suppressedCoefficients).toEqual([])
  })

  it('scopes a receipt tool trace to the calls that produced its own scenario', () => {
    const accept = (id: string) => ({ type: 'accept' as const, id, meta: { actor: 'human' as const, action: 'accept', summary: 'accepted proposal' } })
    let state = createInitialState()
    state = civicReducer(state, { type: 'stage', scenario: stagedScenario(), meta: { ...toolMeta, action: 'preview_scenario' } })
    state = civicReducer(state, accept('scenario-1'))
    state = civicReducer(state, { type: 'stage', scenario: stagedScenario(), meta: { ...toolMeta, action: 'revise_scenario' } })
    state = civicReducer(state, accept('scenario-2'))

    expect(state.accepted[0]?.toolTrace.map(({ action }) => action)).toEqual(['preview_scenario'])
    // The second receipt must not re-report the first receipt's call as its own provenance.
    expect(state.accepted[1]?.toolTrace.map(({ action }) => action)).toEqual(['revise_scenario'])
  })

  it('treats view-only selections as non-versioned, so they cannot invalidate an agent turn', () => {
    const initial = civicReducer(createInitialState(), { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    let state = civicReducer(initial, { type: 'setUiSelection', selection: { selectedDistrict: 'river_ward' } })
    state = civicReducer(state, { type: 'selectCoefficient', coefficientId: 'cf_housing_stability' })

    expect(state.stateVersion).toBe(initial.stateVersion)
    expect(state.activity).toEqual(initial.activity)
    expect(state.ui.selectedDistrict).toBe('river_ward')
    expect(state.selectedCoefficient).toBe('cf_housing_stability')
  })

  it('rejects saved receipts that predate the scoped tool trace contract', () => {
    let state = civicReducer(createInitialState(), { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    state = civicReducer(state, { type: 'accept', id: 'scenario-1', meta: { actor: 'human', action: 'accept', summary: 'accepted proposal' } })
    const legacy = JSON.parse(serializePersistentState(state))
    delete legacy.accepted[0].activityId
    expect(() => restorePersistentState(JSON.stringify(legacy))).toThrow()
  })

  it('keeps a receipt trace intact for a scenario accepted after a reload', () => {
    let state = civicReducer(createInitialState(), { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    state = civicReducer(state, { type: 'accept', id: 'scenario-1', meta: { actor: 'human', action: 'accept', summary: 'accepted proposal' } })

    let reloaded = restorePersistentState(serializePersistentState(state))
    reloaded = civicReducer(reloaded, { type: 'stage', scenario: stagedScenario(), meta: { ...toolMeta, action: 'revise_scenario' } })
    reloaded = civicReducer(reloaded, { type: 'accept', id: 'scenario-2', meta: { actor: 'human', action: 'accept', summary: 'accepted proposal' } })

    expect(reloaded.accepted[1]?.toolTrace.map(({ action }) => action)).toEqual(['revise_scenario'])
    expect(reloaded.accepted[1]?.activityId).toBeGreaterThan(reloaded.accepted[0]!.activityId)
  })

  it('round-trips only canonical accepted state', () => {
    let state = civicReducer(createInitialState(), { type: 'stage', scenario: stagedScenario(), meta: toolMeta })
    state = civicReducer(state, { type: 'accept', id: 'scenario-1', meta: { actor: 'human', action: 'accept', summary: 'accepted proposal' } })
    const restored = restorePersistentState(serializePersistentState(state))
    expect(restored.canonical).toEqual(state.canonical)
    expect(restored.accepted).toEqual(state.accepted)
    expect(restored.staged).toBeNull()
    expect(restored.activity).toEqual([])
  })
})
