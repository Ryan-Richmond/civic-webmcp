import { COEFFICIENTS, DISTRICTS, MODEL_VERSION, PROGRAMS } from '../model/fixtures'
import { normalizeWeightVector, solveScenario } from '../engine/solve'
import { OUTCOME_IDS, PROGRAM_IDS } from '../model/types'
import type { CivicAction, CivicState, FocusState, ScenarioIntent } from '../state/civicState'
import type { CoefficientId, DistrictId, OutcomeId, ProgramId, Targets } from '../model/types'

export interface ToolEnvironment {
  getState: () => CivicState
  dispatch: (action: CivicAction) => void
}

export interface ToolRegistration {
  controller: AbortController
  ready: Promise<void>
}

const staleResponse = (expected: number, actual: number) => ({
  error: 'stale_state',
  expectedStateVersion: expected,
  currentStateVersion: actual,
  recovery: 'Call get_civic_state, then retry with its stateVersion.',
})

function requireCurrent(input: Record<string, unknown>, environment: ToolEnvironment) {
  const expected = input.stateVersion
  const actual = environment.getState().stateVersion
  return expected === actual ? null : staleResponse(typeof expected === 'number' ? expected : -1, actual)
}

function dollarsToTenths(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value * 10 - Math.round(value * 10)) > 1e-8) {
    throw new Error(`${label} must be a number on the $0.1M grid`)
  }
  return Math.round(value * 10)
}

function parseTargets(value: unknown): Targets | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') throw new Error('targets must be an object')
  const targets: Targets = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!PROGRAM_IDS.includes(key as ProgramId) || !raw || typeof raw !== 'object') throw new Error(`Invalid target ${key}`)
    const record = raw as Record<string, unknown>
    targets[key as ProgramId] = {
      ...(record.minimum === undefined ? {} : { minimum: dollarsToTenths(record.minimum, `${key}.minimum`) }),
      ...(record.maximum === undefined ? {} : { maximum: dollarsToTenths(record.maximum, `${key}.maximum`) }),
    }
  }
  return targets
}

function stateSchema(version: number) {
  return { type: 'integer', const: version, description: 'The stateVersion returned by get_civic_state.' }
}

function scenarioSchema(state: CivicState) {
  const unpinned = PROGRAM_IDS.filter((id) => state.pins[id] === undefined)
  return {
    type: 'object',
    additionalProperties: false,
    required: ['stateVersion', 'name', 'weights', 'rationale'],
    properties: {
      stateVersion: stateSchema(state.stateVersion),
      name: { type: 'string', minLength: 1, maxLength: 80 },
      weights: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(OUTCOME_IDS.map((id) => [id, { type: 'number', minimum: 0, maximum: 1 }])),
      },
      protectedPrograms: { type: 'array', uniqueItems: true, items: { type: 'string', enum: unpinned } },
      targets: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(PROGRAM_IDS.map((id) => [id, {
          type: 'object',
          additionalProperties: false,
          properties: { minimum: { type: 'number', multipleOf: 0.1 }, maximum: { type: 'number', multipleOf: 0.1 } },
        }])),
      },
      changeCap: { type: 'number', minimum: 0, maximum: 1, default: 0.3 },
      rationale: { type: 'string', minLength: 1, maxLength: 300 },
    },
  }
}

function parseScenario(input: Record<string, unknown>, state: CivicState): ScenarioIntent {
  const rawWeights = (input.weights ?? {}) as Record<string, unknown>
  const weights = normalizeWeightVector(Object.fromEntries(
    OUTCOME_IDS.map((id) => [id, typeof rawWeights[id] === 'number' ? rawWeights[id] : 0]),
  ))
  const protectedPrograms = Array.isArray(input.protectedPrograms)
    ? input.protectedPrograms.filter((id): id is ProgramId => PROGRAM_IDS.includes(id as ProgramId))
    : []
  const targets = parseTargets(input.targets)
  const request = {
    weights,
    canonical: state.canonical,
    pins: state.pins,
    protectedPrograms,
    ...(targets === undefined ? {} : { targets }),
    ...(typeof input.changeCap === 'number' ? { changeCap: input.changeCap } : {}),
  }
  return {
    name: typeof input.name === 'string' ? input.name : 'Untitled scenario',
    rationale: typeof input.rationale === 'string' ? input.rationale : '',
    request,
  }
}

function scenarioTool(name: 'preview_scenario' | 'revise_scenario', state: CivicState, environment: ToolEnvironment): WebMCP.ModelContextTool {
  return {
    name,
    title: name === 'preview_scenario' ? 'Preview a scenario' : 'Revise the staged scenario',
    description: 'Run Civic’s deterministic local budget engine. This can stage a proposal but cannot accept it.',
    inputSchema: scenarioSchema(state),
    execute: (input) => {
      const stale = requireCurrent(input, environment)
      if (stale) return stale
      const current = environment.getState()
      const nextStateVersion = current.stateVersion + 1
      const intent = parseScenario(input, current)
      const result = solveScenario(intent.request)
      environment.dispatch({ type: 'stage', scenario: { intent, result }, meta: { actor: 'tool', action: name, summary: result.status === 'feasible' ? 'staged a feasible proposal' : `no plan: requires $${(result.requiredTotal / 10).toFixed(1)}M` } })
      return { status: result.status, stateVersion: nextStateVersion, result }
    },
  }
}

export function buildCivicTools(state: CivicState, environment: ToolEnvironment): WebMCP.ModelContextTool[] {
  const versioned = (properties: Record<string, object> = {}) => ({
    type: 'object',
    additionalProperties: false,
    required: ['stateVersion'],
    properties: { stateVersion: stateSchema(state.stateVersion), ...properties },
  })
  const tools: WebMCP.ModelContextTool[] = [
    {
      name: 'get_civic_state',
      title: 'Get Civic state',
      description: 'Read the current model, scenario, pin, and UI state. Call this first and after stale_state errors.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      annotations: { readOnlyHint: true },
      execute: () => {
        const current = environment.getState()
        return { stateVersion: current.stateVersion, modelVersion: current.modelVersion, canonical: current.canonical, staged: current.staged, pins: current.pins, focus: current.focus }
      },
    },
    {
      name: 'get_model_details',
      title: 'Inspect the Civic model',
      description: 'Read disclosed program bounds, coefficients, constraints, and the fictional-model disclaimer.',
      inputSchema: versioned({ programs: { type: 'array', items: { type: 'string', enum: PROGRAM_IDS } } }),
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const stale = requireCurrent(input, environment)
        if (stale) return stale
        const requested = Array.isArray(input.programs) ? input.programs : PROGRAM_IDS
        return {
          modelVersion: MODEL_VERSION,
          programs: PROGRAMS.filter((program) => requested.includes(program.id)),
          coefficients: COEFFICIENTS.filter((coefficient) => requested.includes(coefficient.programId)),
          constraints: ['total = $100.0M', 'statutory program bounds', '30% default change cap', 'pins are immutable to scenario tools', 'stateVersion must match'],
          disclaimer: 'Harbor City is fictional. Outcome indices are illustrative, not forecasts or evidence of causation.',
        }
      },
    },
    {
      name: 'focus_tradeoffs',
      title: 'Focus tradeoffs',
      description: 'Focus programs, districts, and outcomes in Civic without changing the scenario.',
      inputSchema: versioned({
        programs: { type: 'array', items: { type: 'string', enum: PROGRAM_IDS } },
        districts: { type: 'array', items: { type: 'string', enum: DISTRICTS.map(({ id }) => id) } },
        outcomes: { type: 'array', items: { type: 'string', enum: OUTCOME_IDS } },
      }),
      execute: (input) => {
        const stale = requireCurrent(input, environment)
        if (stale) return stale
        const nextStateVersion = environment.getState().stateVersion + 1
        const focus: FocusState = {
          programs: (Array.isArray(input.programs) ? input.programs : []).filter((id): id is ProgramId => PROGRAM_IDS.includes(id as ProgramId)),
          districts: (Array.isArray(input.districts) ? input.districts : []).filter((id): id is DistrictId => DISTRICTS.some((district) => district.id === id)),
          outcomes: (Array.isArray(input.outcomes) ? input.outcomes : []).filter((id): id is OutcomeId => OUTCOME_IDS.includes(id as OutcomeId)),
        }
        environment.dispatch({ type: 'focus', focus, meta: { actor: 'tool', action: 'focus_tradeoffs', summary: 'focused visible tradeoffs' } })
        return { status: 'focused', stateVersion: nextStateVersion, focus }
      },
    },
    scenarioTool(state.staged ? 'revise_scenario' : 'preview_scenario', state, environment),
  ]

  if (state.staged) {
    tools.push({
      name: 'compare_scenarios', title: 'Compare scenarios', description: 'Compare canonical and staged allocations.',
      inputSchema: versioned(), annotations: { readOnlyHint: true },
      execute: (input) => {
        const stale = requireCurrent(input, environment)
        if (stale) return stale
        const current = environment.getState()
        return { canonical: current.canonical, staged: current.staged?.result ?? null }
      },
    })
    tools.push({
      name: 'discard_preview', title: 'Discard preview', description: 'Discard the staged proposal. This never changes the accepted allocation.',
      inputSchema: versioned(),
      execute: (input) => {
        const stale = requireCurrent(input, environment)
        if (stale) return stale
        const nextStateVersion = environment.getState().stateVersion + 1
        environment.dispatch({ type: 'discard', meta: { actor: 'tool', action: 'discard_preview', summary: 'discarded the staged proposal' } })
        return { status: 'discarded', stateVersion: nextStateVersion }
      },
    })
  }

  const pinnedIds = PROGRAM_IDS.filter((id) => state.pins[id] !== undefined)
  if (pinnedIds.length > 0) tools.push({
    name: 'unpin_program', title: 'Unpin a program', description: 'Remove a human-created pin at the human’s spoken request.',
    inputSchema: versioned({ programId: { type: 'string', enum: pinnedIds } }),
    execute: (input) => {
      const stale = requireCurrent(input, environment)
      if (stale) return stale
      const nextStateVersion = environment.getState().stateVersion + 1
      const programId = input.programId as ProgramId
      environment.dispatch({ type: 'unpin', programId, meta: { actor: 'tool', action: 'unpin_program', summary: `removed the ${programId} pin` } })
      return { status: 'unpinned', stateVersion: nextStateVersion, programId }
    },
  })

  if (state.selectedCoefficient) tools.push({
    name: 'test_assumption', title: 'Test a selected assumption', description: 'Suppress the selected coefficient for preview only. It cannot be accepted.',
    inputSchema: versioned({ coefficientId: { type: 'string', enum: [state.selectedCoefficient] }, suppressed: { type: 'boolean', default: true } }),
    execute: (input) => {
      const stale = requireCurrent(input, environment)
      if (stale) return stale
      const nextStateVersion = environment.getState().stateVersion + 1
      const coefficientId = input.coefficientId as CoefficientId
      environment.dispatch({ type: 'setSuppression', coefficientId, suppressed: input.suppressed !== false, meta: { actor: 'tool', action: 'test_assumption', summary: `tested ${coefficientId}` } })
      return { status: 'counterfactual', stateVersion: nextStateVersion, coefficientId }
    },
  })

  return tools
}

/** The exact tool names Civic would register for this state, so the activity rail cannot drift from the real surface. */
export function civicToolNames(state: CivicState): string[] {
  const inert: ToolEnvironment = { getState: () => state, dispatch: () => {} }
  return buildCivicTools(state, inert).map((tool) => tool.name)
}

export function registerCivicTools(modelContext: WebMCP.ModelContext, state: CivicState, environment: ToolEnvironment): ToolRegistration {
  const controller = new AbortController()
  const ready = Promise.all(
    buildCivicTools(state, environment).map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
  ).then(() => undefined)
  return { controller, ready }
}
