import { describe, expect, it } from 'vitest'
import { civicReducer, createInitialState, restorePersistentState, serializePersistentState, stagedPinConflicts } from './civicState'
import { activityCounts, changeList, describeBaseline, describeDistrict, describeScenario } from './summaries'
import { solveScenario } from '../engine/solve'
import { BASELINE_ALLOCATION, SIGNATURE_WEIGHTS } from '../model/fixtures'
import type { CivicState } from './civicState'

const meta = (actor: 'human' | 'tool', action: string) => ({ actor, action, summary: `${action} ran` })

function staged(state: CivicState = createInitialState()): CivicState {
  const request = { weights: SIGNATURE_WEIGHTS, canonical: state.canonical, pins: state.pins, protectedPrograms: ['emergency' as const] }
  const result = solveScenario(request)
  return civicReducer(state, { type: 'stage', scenario: { intent: { name: 'Housing and access first', rationale: 'weights', request }, result }, meta: meta('tool', 'preview_scenario') })
}

describe('changeList', () => {
  it('reports only programs that moved, largest absolute move first', () => {
    const state = staged()
    const allocation = state.staged?.result.status === 'feasible' ? state.staged.result.allocation : BASELINE_ALLOCATION
    const changes = changeList(BASELINE_ALLOCATION, allocation)

    expect(changes.length).toBeGreaterThan(0)
    expect(changes.every(({ delta }) => delta !== 0)).toBe(true)
    const magnitudes = changes.map((change) => Math.abs(change.delta))
    expect(magnitudes).toEqual([...magnitudes].sort((a, b) => b - a))
    expect(changes.reduce((sum, change) => sum + change.delta, 0)).toBe(0)
    expect(changes[0]).toMatchObject({ programId: 'housing', direction: 'up', from: 150, to: 195 })
  })

  it('is empty when nothing moved', () => {
    expect(changeList(BASELINE_ALLOCATION, BASELINE_ALLOCATION)).toEqual([])
  })
})

describe('screen-reader summaries', () => {
  it('describes the baseline with its largest three programs', () => {
    const summary = describeBaseline(createInitialState())
    expect(summary).toContain('$100.0M across 8 programs')
    expect(summary).toContain('Emergency Response $20.0M')
    expect(summary).toContain('This is the published baseline.')
  })

  it('says a staged scenario is not accepted and keeps the total exact', () => {
    const summary = describeScenario(staged())
    expect(summary).toContain('total stays at $100.0M')
    expect(summary).toContain('only a human control can accept it')
    expect(summary).toContain('Housing Stability up 4.5 to $19.5M')
  })

  it('explains an infeasible request in plain language with every binding constraint', () => {
    let state = createInitialState()
    for (const programId of ['climate', 'youth', 'libraries'] as const) {
      state = civicReducer(state, { type: 'pin', programId, value: state.canonical[programId], meta: meta('human', 'pin') })
    }
    const request = { weights: SIGNATURE_WEIGHTS, canonical: state.canonical, pins: state.pins, targets: { housing: { minimum: 280 }, transit: { minimum: 220 } } }
    state = civicReducer(state, { type: 'stage', scenario: { intent: { name: 'Firm targets', rationale: 'firm floors', request }, result: solveScenario(request) }, meta: meta('tool', 'revise_scenario') })

    const summary = describeScenario(state)
    expect(summary).toContain('No plan for “Firm targets”')
    expect(summary).toContain('require $112.4M against $100.0M')
    expect(summary).toContain('5 binding constraints')
    expect(summary).toContain('Nothing changed')
    expect(summary).toContain('Youth and Learning at $14.0M')
  })

  it('describes a district across all four indices with direction and magnitude', () => {
    const state = staged()
    const allocation = state.staged?.result.status === 'feasible' ? state.staged.result.allocation : BASELINE_ALLOCATION
    const summary = describeDistrict(state, 'river_ward', allocation)
    expect(summary).toContain('River Ward')
    expect(summary).toContain('Household Stability')
    expect(summary).toMatch(/up|down|no change/)
  })
})

describe('activityCounts', () => {
  it('never reports a human decision as an agent tool call', () => {
    let state = staged()
    state = civicReducer(state, { type: 'pin', programId: 'climate', value: 80, meta: meta('human', 'pin') })
    state = civicReducer(state, { type: 'focus', focus: { programs: ['housing'], districts: [], outcomes: [] }, meta: meta('tool', 'focus_tradeoffs') })

    expect(activityCounts(state)).toEqual({ toolCalls: 2, humanDecisions: 1 })
  })
})

describe('decision receipt record', () => {
  it('stores what moved, the pins held, and the version it was accepted at', () => {
    let state = civicReducer(createInitialState(), { type: 'pin', programId: 'climate', value: 80, meta: meta('human', 'pin') })
    state = staged(state)
    const accepted = civicReducer(state, { type: 'accept', id: 'receipt-1', meta: meta('human', 'accept') })
    const receipt = accepted.accepted.at(-1)

    expect(receipt?.from).toEqual(state.canonical)
    expect(receipt?.pins).toEqual({ climate: 80 })
    expect(receipt?.stateVersion).toBe(accepted.stateVersion)
    expect(changeList(receipt!.from, receipt!.allocation).length).toBeGreaterThan(0)
    expect(accepted.canonical).toEqual(receipt?.allocation)
  })

  it('refuses persisted receipts that predate the receipt contract', () => {
    const legacy = JSON.stringify({ modelVersion: 'hc-1.0', canonical: BASELINE_ALLOCATION, accepted: [{ id: 'old', name: 'Old', rationale: '', allocation: BASELINE_ALLOCATION, modelVersion: 'hc-1.0' }] })
    expect(() => restorePersistentState(legacy)).toThrow(/receipt contract/)
  })

  it('round trips a current receipt', () => {
    const accepted = civicReducer(staged(), { type: 'accept', id: 'receipt-2', meta: meta('human', 'accept') })
    expect(restorePersistentState(serializePersistentState(accepted)).accepted).toEqual(accepted.accepted)
  })
})

describe('pins bind an already-staged preview', () => {
  it('refuses to accept a preview that was solved before the pin was set', () => {
    const preview = staged()
    const pinned = civicReducer(preview, { type: 'pin', programId: 'youth', value: 140, meta: meta('human', 'pin') })

    expect(stagedPinConflicts(pinned)).toEqual(['youth'])
    const attempted = civicReducer(pinned, { type: 'accept', id: 'blocked', meta: meta('human', 'accept') })
    expect(attempted.accepted).toEqual([])
    expect(attempted.canonical).toEqual(pinned.canonical)
    expect(describeScenario(pinned)).toContain('cannot be accepted until the agent revises it')
  })

  it('accepts once the agent revises against the pin', () => {
    let state = civicReducer(createInitialState(), { type: 'pin', programId: 'youth', value: 140, meta: meta('human', 'pin') })
    state = staged(state)

    expect(stagedPinConflicts(state)).toEqual([])
    const accepted = civicReducer(state, { type: 'accept', id: 'ok', meta: meta('human', 'accept') })
    expect(accepted.accepted).toHaveLength(1)
    expect(accepted.canonical.youth).toBe(140)
  })
})
