import { BASELINE_ALLOCATION, BASELINE_VERSION, MODEL_VERSION, TOTAL_BUDGET } from '../model/fixtures'
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
  baselineVersion: string
  modelVersion: string
  request: SolveRequest
  toolTrace: ActivityEntry[]
  constraintChecks: string[]
  humanDecision: string
}

export interface FocusState {
  programs: ProgramId[]
  districts: DistrictId[]
  outcomes: OutcomeId[]
}

export interface ActivityEntry {
  id: number
  stateVersion: number
  actor: 'human' | 'tool'
  action: string
  summary: string
}

export interface UiState {
  selectedProgram: ProgramId | null
  selectedDistrict: DistrictId | null
  selectedOutcome: OutcomeId
}

export interface CivicState {
  stateVersion: number
  activitySequence: number
  baselineVersion: string
  modelVersion: string
  canonical: Allocation
  accepted: AcceptedScenario[]
  staged: StagedScenario | null
  pins: Pins
  selectedCoefficient: CoefficientId | null
  suppressedCoefficients: CoefficientId[]
  focus: FocusState
  ui: UiState
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
  | { type: 'setUiSelection'; selection: Partial<UiState> }
  | { type: 'logActivity'; meta: ActivityMeta }
  | { type: 'reset'; meta: ActivityMeta }

const emptyFocus = (): FocusState => ({ programs: [], districts: [], outcomes: [] })
const defaultUi = (): UiState => ({ selectedProgram: null, selectedDistrict: null, selectedOutcome: 'stability' })

export function createInitialState(): CivicState {
  return {
    stateVersion: 1,
    activitySequence: 0,
    baselineVersion: BASELINE_VERSION,
    modelVersion: MODEL_VERSION,
    canonical: { ...BASELINE_ALLOCATION },
    accepted: [],
    staged: null,
    pins: {},
    selectedCoefficient: null,
    suppressedCoefficients: [],
    focus: emptyFocus(),
    ui: defaultUi(),
    activity: [],
  }
}

function withActivity(state: CivicState, meta: ActivityMeta): Pick<CivicState, 'stateVersion' | 'activitySequence' | 'activity'> {
  const stateVersion = state.stateVersion + 1
  const activitySequence = state.activitySequence + 1
  return {
    stateVersion,
    activitySequence,
    activity: [...state.activity, { id: activitySequence, stateVersion, ...meta }],
  }
}

function logActivity(state: CivicState, meta: ActivityMeta): Pick<CivicState, 'activitySequence' | 'activity'> {
  const activitySequence = state.activitySequence + 1
  return {
    activitySequence,
    activity: [...state.activity, { id: activitySequence, stateVersion: state.stateVersion, ...meta }],
  }
}

function acceptedConstraintChecks(state: CivicState): string[] {
  const feasible = state.staged?.result.status === 'feasible' ? state.staged.result : null
  if (!feasible) return []
  return [
    `Allocation totals exactly $${(TOTAL_BUDGET / 10).toFixed(1)}M`,
    'Every program remains inside its effective bounds',
    `${Object.keys(state.pins).length} human ${Object.keys(state.pins).length === 1 ? 'pin was' : 'pins were'} preserved`,
    'No suppressed assumption entered the accepted scenario',
  ]
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
        baselineVersion: state.baselineVersion,
        modelVersion: state.modelVersion,
        request: state.staged.intent.request,
        toolTrace: state.activity.filter((entry) => entry.actor === 'tool'),
        constraintChecks: acceptedConstraintChecks(state),
        humanDecision: action.meta.summary,
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
      return {
        ...state,
        ...withActivity(state, action.meta),
        focus: action.focus,
        ui: {
          selectedProgram: action.focus.programs[0] ?? state.ui.selectedProgram,
          selectedDistrict: action.focus.districts[0] ?? state.ui.selectedDistrict,
          selectedOutcome: action.focus.outcomes[0] ?? state.ui.selectedOutcome,
        },
      }
    case 'setUiSelection':
      return { ...state, stateVersion: state.stateVersion + 1, ui: { ...state.ui, ...action.selection } }
    case 'logActivity':
      return { ...state, ...logActivity(state, action.meta) }
    case 'reset': {
      const reset = createInitialState()
      const stateVersion = state.stateVersion + 1
      const activitySequence = state.activitySequence + 1
      return {
        ...reset,
        stateVersion,
        activitySequence,
        activity: [{ id: activitySequence, stateVersion, ...action.meta }],
      }
    }
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
  if (parsed.accepted.some((scenario) => !scenario.from || !scenario.pins || !scenario.request || !scenario.toolTrace || !scenario.constraintChecks || !scenario.humanDecision)) {
    throw new Error('Saved Civic receipts predate the current receipt contract')
  }
  return { ...createInitialState(), canonical: parsed.canonical, accepted: parsed.accepted }
}
