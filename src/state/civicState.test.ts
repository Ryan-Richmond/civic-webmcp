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
