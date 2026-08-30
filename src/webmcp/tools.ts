import { BASELINE_ALLOCATION, COEFFICIENTS, DISTRICTS, MODEL_VERSION, PROGRAMS, TOTAL_BUDGET } from '../model/fixtures'
import { normalizeWeightVector, solveScenario } from '../engine/solve'
import type { SolveResult } from '../engine/solve'
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

function stateSchema() {
  return { type: 'integer', minimum: 1, description: 'The current stateVersion returned by get_civic_state.' }
}

const compactAllocation = (allocation: Record<ProgramId, number>) => Object.fromEntries(
  PROGRAM_IDS.map((id) => [id, allocation[id] / 10]),
)

const compactBinding = (binding: { programId: ProgramId; cause: string; relation: string; detail: string }) => ({
  program: binding.programId,
  cause: binding.cause,
  relation: binding.relation,
  detail: binding.detail,
})

function compactResult(result: SolveResult) {
  if (result.status === 'feasible') {
    return {
      status: result.status,
      allocation: compactAllocation(result.allocation),
      bindings: result.bindings.map(compactBinding),
    }
  }
  return {
    status: result.status,
    reason: result.reason,
    budget: result.availableTotal / 10,
    minimumRequired: result.requiredTotal / 10,
    maximumAvailable: result.maximumTotal / 10,
    conflicts: result.conflicts.map(compactBinding),
  }
}

function scenarioSchema(state: CivicState) {
  const unpinned = PROGRAM_IDS.filter((id) => state.pins[id] === undefined)
  return {
    type: 'object',
    additionalProperties: false,
    required: ['stateVersion', 'name', 'weights', 'rationale'],
    properties: {
      stateVersion: stateSchema(),
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
      environment.dispatch({ type: 'stage', scenario: { intent, result }, meta: { actor: 'tool', action: name, summary: result.status === 'feasible' ? 'staged a feasible proposal' : `no plan: ${result.conflicts.length} conflicting request constraints` } })
      return { stateVersion: nextStateVersion, ...compactResult(result) }
    },
  }
}

export function buildCivicTools(state: CivicState, environment: ToolEnvironment): WebMCP.ModelContextTool[] {
  const versioned = (properties: Record<string, object> = {}) => ({
    type: 'object',
    additionalProperties: false,
    required: ['stateVersion'],
    properties: { stateVersion: stateSchema(), ...properties },
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
        const latestAccepted = current.accepted.at(-1)
        const staged = current.staged
          ? { name: current.staged.intent.name, rationale: current.staged.intent.rationale, ...compactResult(current.staged.result) }
          : null
        const response = {
          stateVersion: current.stateVersion,
          baselineVersion: current.baselineVersion,
          modelVersion: current.modelVersion,
          units: 'USD millions',
          canonical: compactAllocation(current.canonical),
          staged,
          latestAccepted: latestAccepted ? {
            id: latestAccepted.id,
            name: latestAccepted.name,
            stateVersion: latestAccepted.stateVersion,
            allocation: compactAllocation(latestAccepted.allocation),
          } : null,
          pins: Object.fromEntries(Object.entries(current.pins).map(([id, value]) => [id, (value as number) / 10])),
          ui: current.ui,
          agentFocus: current.focus,
        }
        environment.dispatch({ type: 'logActivity', meta: { actor: 'tool', action: 'get_civic_state', summary: 'read current Civic state' } })
        return response
      },
    },
    {
      name: 'get_model_details',
      title: 'Inspect the Civic model',
      description: 'Read disclosed program bounds, coefficients, constraints, and the fictional-model disclaimer.',
      inputSchema: versioned({ programs: { type: 'array', uniqueItems: true, maxItems: 4, items: { type: 'string', enum: PROGRAM_IDS } } }),
      annotations: { readOnlyHint: true },
      execute: (input) => {
        const stale = requireCurrent(input, environment)
        if (stale) return stale
        const requested = Array.isArray(input.programs)
          ? input.programs.filter((id): id is ProgramId => PROGRAM_IDS.includes(id as ProgramId))
          : []
        const selected = requested.length > 0 ? PROGRAMS.filter((program) => requested.includes(program.id)) : PROGRAMS
        const response = {
          modelVersion: MODEL_VERSION,
          units: 'USD millions',
          budget: TOTAL_BUDGET / 10,
          programs: selected.map((program) => ({
            id: program.id,
            label: program.label,
            baseline: program.baseline / 10,
            min: program.minimum / 10,
            max: program.maximum / 10,
            ...(requested.length === 0 ? {} : {
              effects: COEFFICIENTS.filter((coefficient) => coefficient.programId === program.id).map((coefficient) => ({
                outcome: coefficient.outcomeId,
                value: coefficient.value,
                confidence: coefficient.confidence,
                provenance: coefficient.provenance,
              })),
            }),
          })),
          constraints: ['total=100', 'statutory bounds', '30% default change cap', 'pins immutable', 'matching stateVersion'],
          disclaimer: 'Harbor City is fictional. Outcome indices are illustrative, not forecasts or evidence of causation.',
          ...(requested.length === 0 ? { next: 'Re-call with up to four program IDs for coefficients.' } : {}),
        }
        environment.dispatch({ type: 'logActivity', meta: { actor: 'tool', action: 'get_model_details', summary: requested.length === 0 ? 'read model overview' : `read details for ${requested.join(', ')}` } })
        return response
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
        const response = {
          units: 'USD millions',
          baseline: compactAllocation(BASELINE_ALLOCATION),
          canonical: compactAllocation(current.canonical),
          staged: current.staged ? compactResult(current.staged.result) : null,
          latestAccepted: current.accepted.at(-1)?.name ?? null,
        }
        environment.dispatch({ type: 'logActivity', meta: { actor: 'tool', action: 'compare_scenarios', summary: 'compared baseline, canonical, and staged state' } })
        return response
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

/** Changes only when the registered names or schemas change, avoiding registration churn on ordinary state updates. */
export function civicToolSurfaceKey(state: CivicState): string {
  const pinnedIds = PROGRAM_IDS.filter((id) => state.pins[id] !== undefined)
  return [state.staged ? 'staged' : 'baseline', pinnedIds.join(','), state.selectedCoefficient ?? ''].join('|')
}

export function registerCivicTools(modelContext: WebMCP.ModelContext, state: CivicState, environment: ToolEnvironment): ToolRegistration {
  const controller = new AbortController()
  const ready = Promise.all(
    buildCivicTools(state, environment).map((tool) => modelContext.registerTool(tool, { signal: controller.signal })),
  ).then(() => undefined)
  return { controller, ready }
}
