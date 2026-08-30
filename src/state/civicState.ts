import { BASELINE_ALLOCATION, MODEL_VERSION } from '../model/fixtures'
import { PROGRAM_IDS } from '../model/types'
import type { SolveRequest, SolveResult } from '../engine/solve'
import type { Allocation, CoefficientId, DistrictId, OutcomeId, Pins, ProgramId } from '../model/types'

export interface ScenarioIntent {
  name: string
  rationale: string
  request: SolveRequest
}

export interface StagedScenario {
  intent: ScenarioIntent
  result: SolveResult
}

export interface AcceptedScenario {
  id: string
  name: string
  rationale: string
  /** The allocation this scenario replaced, so the receipt can name what actually moved. */
  from: Allocation
  allocation: Allocation
  pins: Pins
  stateVersion: number
  modelVersion: string
}

export interface FocusState {
  programs: ProgramId[]
  districts: DistrictId[]
  outcomes: OutcomeId[]
}

export interface ActivityEntry {
  id: number
  actor: 'human' | 'tool'
  action: string
  summary: string
}

export interface CivicState {
  stateVersion: number
  modelVersion: string
  canonical: Allocation
  accepted: AcceptedScenario[]
  staged: StagedScenario | null
  pins: Pins
  selectedCoefficient: CoefficientId | null
  suppressedCoefficients: CoefficientId[]
  focus: FocusState
  activity: ActivityEntry[]
}

interface ActivityMeta {
  actor: ActivityEntry['actor']
  action: string
  summary: string
}

export type CivicAction =
  | { type: 'pin'; programId: ProgramId; value: number; meta: ActivityMeta }
  | { type: 'unpin'; programId: ProgramId; meta: ActivityMeta }
  | { type: 'stage'; scenario: StagedScenario; meta: ActivityMeta }
  | { type: 'discard'; meta: ActivityMeta }
  | { type: 'accept'; id: string; meta: ActivityMeta }
  | { type: 'selectCoefficient'; coefficientId: CoefficientId | null }
  | { type: 'setSuppression'; coefficientId: CoefficientId; suppressed: boolean; meta: ActivityMeta }
  | { type: 'focus'; focus: FocusState; meta: ActivityMeta }
  | { type: 'reset'; meta: ActivityMeta }

const emptyFocus = (): FocusState => ({ programs: [], districts: [], outcomes: [] })

export function createInitialState(): CivicState {
  return {
    stateVersion: 1,
    modelVersion: MODEL_VERSION,
    canonical: { ...BASELINE_ALLOCATION },
    accepted: [],
    staged: null,
    pins: {},
    selectedCoefficient: null,
    suppressedCoefficients: [],
    focus: emptyFocus(),
    activity: [],
  }
}

function withActivity(state: CivicState, meta: ActivityMeta): Pick<CivicState, 'stateVersion' | 'activity'> {
  const stateVersion = state.stateVersion + 1
  return {
    stateVersion,
    activity: [...state.activity, { id: stateVersion, ...meta }],
  }
}

/**
 * A preview solved before the human pinned a program can contradict that pin.
 * Pins bind every plan, so such a preview must not be acceptable until the agent revises it.
 */
export function stagedPinConflicts(state: CivicState): ProgramId[] {
  if (state.staged?.result.status !== 'feasible') return []
  const { allocation } = state.staged.result
  return PROGRAM_IDS.filter((programId) => state.pins[programId] !== undefined && allocation[programId] !== state.pins[programId])
}

export function civicReducer(state: CivicState, action: CivicAction): CivicState {
  switch (action.type) {
    case 'pin':
      return { ...state, ...withActivity(state, action.meta), pins: { ...state.pins, [action.programId]: action.value } }
    case 'unpin': {
      const pins = { ...state.pins }
      delete pins[action.programId]
      return { ...state, ...withActivity(state, action.meta), pins }
    }
    case 'stage':
      return { ...state, ...withActivity(state, action.meta), staged: action.scenario, suppressedCoefficients: [] }
    case 'discard':
      return { ...state, ...withActivity(state, action.meta), staged: null, suppressedCoefficients: [] }
    case 'accept': {
      if (state.staged?.result.status !== 'feasible' || stagedPinConflicts(state).length > 0) return state
      const accepted: AcceptedScenario = {
        id: action.id,
        name: state.staged.intent.name,
        rationale: state.staged.intent.rationale,
        from: { ...state.canonical },
        allocation: { ...state.staged.result.allocation },
        pins: { ...state.pins },
        stateVersion: state.stateVersion + 1,
        modelVersion: state.modelVersion,
      }
      return {
        ...state,
        ...withActivity(state, action.meta),
        canonical: { ...accepted.allocation },
        accepted: [...state.accepted, accepted],
        staged: null,
        suppressedCoefficients: [],
      }
    }
    case 'selectCoefficient':
      return { ...state, stateVersion: state.stateVersion + 1, selectedCoefficient: action.coefficientId }
    case 'setSuppression': {
      const suppressed = new Set(state.suppressedCoefficients)
      if (action.suppressed) suppressed.add(action.coefficientId)
      else suppressed.delete(action.coefficientId)
      return { ...state, ...withActivity(state, action.meta), suppressedCoefficients: [...suppressed] }
    }
    case 'focus':
      return { ...state, ...withActivity(state, action.meta), focus: action.focus }
    case 'reset':
      return { ...createInitialState(), stateVersion: state.stateVersion + 1, activity: [{ id: state.stateVersion + 1, ...action.meta }] }
  }
}

export function canonicalAllocation(state: CivicState): Allocation {
  return state.canonical
}

export function serializePersistentState(state: CivicState): string {
  return JSON.stringify({ modelVersion: state.modelVersion, accepted: state.accepted, canonical: state.canonical })
}

export function restorePersistentState(serialized: string): CivicState {
  const parsed = JSON.parse(serialized) as Partial<CivicState>
  if (parsed.modelVersion !== MODEL_VERSION || !parsed.canonical || !Array.isArray(parsed.accepted)) {
    throw new Error('Saved Civic state is incompatible with the current model')
  }
  if (parsed.accepted.some((scenario) => !scenario.from || !scenario.pins)) {
    throw new Error('Saved Civic receipts predate the current receipt contract')
  }
  return { ...createInitialState(), canonical: parsed.canonical, accepted: parsed.accepted }
}
