import { describe, expect, it, vi } from 'vitest'
import { SIGNATURE_WEIGHTS } from '../model/fixtures'
import { civicReducer, createInitialState } from '../state/civicState'
import type { CivicAction, CivicState } from '../state/civicState'
import { buildCivicTools, civicToolNames, registerCivicTools } from './tools'

function harness(seed = createInitialState()) {
  let state = seed
  const environment = {
    getState: () => state,
    dispatch: (action: CivicAction) => { state = civicReducer(state, action) },
  }
  return { environment, get state() { return state } }
}

describe('Civic WebMCP tools', () => {
  it('publishes the correct baseline and staged tool sets', async () => {
    const baseline = harness()
    const baselineTools = buildCivicTools(baseline.state, baseline.environment)
    expect(baselineTools.map(({ name }) => name)).toEqual(['get_civic_state', 'get_model_details', 'focus_tradeoffs', 'preview_scenario'])
    const preview = baselineTools.find(({ name }) => name === 'preview_scenario')!
    await preview.execute({ stateVersion: 1, name: 'Test', weights: SIGNATURE_WEIGHTS, rationale: 'Test' }, { signal: new AbortController().signal })
    expect(buildCivicTools(baseline.state, baseline.environment).map(({ name }) => name)).toEqual([
      'get_civic_state', 'get_model_details', 'focus_tradeoffs', 'revise_scenario', 'compare_scenarios', 'discard_preview',
    ])
  })

  it('exposes the same tool names the activity rail displays', () => {
    const h = harness()
    expect(civicToolNames(h.state)).toEqual(buildCivicTools(h.state, h.environment).map(({ name }) => name))
    h.environment.dispatch({ type: 'pin', programId: 'climate', value: 80, meta: { actor: 'human', action: 'pin', summary: 'pinned climate' } })
    expect(civicToolNames(h.state)).toEqual(buildCivicTools(h.state, h.environment).map(({ name }) => name))
    expect(civicToolNames(h.state)).toContain('unpin_program')
  })

  it('narrows protectedPrograms to currently unpinned programs', () => {
    const h = harness()
    h.environment.dispatch({ type: 'pin', programId: 'climate', value: 80, meta: { actor: 'human', action: 'pin', summary: 'pin climate' } })
    const tool = buildCivicTools(h.state, h.environment).find(({ name }) => name === 'preview_scenario')!
    const schema = tool.inputSchema as { properties: { protectedPrograms: { items: { enum: string[] } } } }
    expect(schema.properties.protectedPrograms.items.enum).not.toContain('climate')
    expect(buildCivicTools(h.state, h.environment).map(({ name }) => name)).toContain('unpin_program')
  })

  it('rejects stale mutations with recovery instructions', async () => {
    const h = harness()
    const tool = buildCivicTools(h.state, h.environment).find(({ name }) => name === 'preview_scenario')!
    h.environment.dispatch({ type: 'pin', programId: 'climate', value: 80, meta: { actor: 'human', action: 'pin', summary: 'pin climate' } })
    const result = await tool.execute({ stateVersion: 1, name: 'Stale', weights: SIGNATURE_WEIGHTS, rationale: 'Stale' }, { signal: new AbortController().signal })
    expect(result).toMatchObject({ error: 'stale_state', currentStateVersion: 2 })
    expect(h.state.staged).toBeNull()
  })

  it('uses an AbortController to unregister an entire tool generation', async () => {
    const registerTool = vi.fn((_tool: WebMCP.ModelContextTool, _options?: WebMCP.ModelContextRegisterToolOptions) => Promise.resolve())
    const context = { registerTool } as unknown as WebMCP.ModelContext
    const h = harness()
    const registration = registerCivicTools(context, h.state, h.environment)
    await registration.ready
    expect(registerTool).toHaveBeenCalledTimes(4)
    const options = registerTool.mock.calls[0]?.[1]
    expect(options?.signal?.aborted).toBe(false)
    registration.controller.abort()
    expect(options?.signal?.aborted).toBe(true)
  })

  it('does not expose scenario acceptance as a tool', () => {
    const h = harness()
    expect(buildCivicTools(h.state, h.environment).map(({ name }) => name)).not.toContain('accept_scenario')
  })

  it('records read tools without changing the scenario state version', async () => {
    const h = harness()
    let tools = buildCivicTools(h.state, h.environment)
    const stateResult = await tools.find(({ name }) => name === 'get_civic_state')!.execute({}, { signal: new AbortController().signal })
    tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'get_model_details')!.execute({ stateVersion: 1 }, { signal: new AbortController().signal })

    expect(stateResult).toMatchObject({
      stateVersion: 1,
      baselineVersion: 'harbor-city-1.0',
      latestAccepted: null,
      ui: { selectedProgram: null, selectedDistrict: null, selectedOutcome: 'stability' },
    })
    expect(h.state.stateVersion).toBe(1)
    expect(h.state.activity.map(({ action }) => action)).toEqual(['get_civic_state', 'get_model_details'])
    expect(h.state.activity.map(({ stateVersion }) => stateVersion)).toEqual([1, 1])
  })

  it('keeps read and mutation outputs inside the Chrome guidance budget', async () => {
    const h = harness()
    let tools = buildCivicTools(h.state, h.environment)
    const overview = await tools.find(({ name }) => name === 'get_model_details')!.execute({ stateVersion: 1 }, { signal: new AbortController().signal })
    expect(JSON.stringify(overview).length).toBeLessThanOrEqual(1_500)

    tools = buildCivicTools(h.state, h.environment)
    const details = await tools.find(({ name }) => name === 'get_model_details')!.execute({ stateVersion: 1, programs: ['housing', 'transit', 'emergency', 'libraries'] }, { signal: new AbortController().signal })
    expect(JSON.stringify(details).length).toBeLessThanOrEqual(1_500)

    tools = buildCivicTools(h.state, h.environment)
    const preview = await tools.find(({ name }) => name === 'preview_scenario')!.execute({ stateVersion: 1, name: 'Compact', weights: SIGNATURE_WEIGHTS, rationale: 'Compact response' }, { signal: new AbortController().signal })
    expect(JSON.stringify(preview).length).toBeLessThanOrEqual(1_500)

    tools = buildCivicTools(h.state, h.environment)
    const stagedState = await tools.find(({ name }) => name === 'get_civic_state')!.execute({}, { signal: new AbortController().signal })
    expect(JSON.stringify(stagedState).length).toBeLessThanOrEqual(1_500)
  })

  it('compares baseline, canonical, and staged state and records the read', async () => {
    const h = harness()
    let tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'preview_scenario')!.execute({ stateVersion: 1, name: 'Compare', weights: SIGNATURE_WEIGHTS, rationale: 'Compare' }, { signal: new AbortController().signal })
    tools = buildCivicTools(h.state, h.environment)
    const comparison = await tools.find(({ name }) => name === 'compare_scenarios')!.execute({ stateVersion: 2 }, { signal: new AbortController().signal })

    expect(comparison).toMatchObject({ units: 'USD millions', latestAccepted: null })
    expect(comparison).toHaveProperty('baseline')
    expect(comparison).toHaveProperty('canonical')
    expect(comparison).toHaveProperty('staged')
    expect(h.state.activity.at(-1)?.action).toBe('compare_scenarios')
    expect(h.state.stateVersion).toBe(2)
  })

  it('reports human UI selection and the latest accepted scenario', async () => {
    const h = harness()
    h.environment.dispatch({ type: 'setUiSelection', selection: { selectedProgram: 'housing', selectedDistrict: 'river_ward', selectedOutcome: 'mobility' } })
    let tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'preview_scenario')!.execute({ stateVersion: 2, name: 'Accepted', weights: SIGNATURE_WEIGHTS, rationale: 'Accepted scenario' }, { signal: new AbortController().signal })
    h.environment.dispatch({ type: 'accept', id: 'accepted-1', meta: { actor: 'human', action: 'accept', summary: 'accepted the scenario' } })
    tools = buildCivicTools(h.state, h.environment)
    const result = await tools.find(({ name }) => name === 'get_civic_state')!.execute({}, { signal: new AbortController().signal })

    expect(result).toMatchObject({
      ui: { selectedProgram: 'housing', selectedDistrict: 'river_ward', selectedOutcome: 'mobility' },
      latestAccepted: { id: 'accepted-1', name: 'Accepted', stateVersion: 4 },
    })
    expect(h.state.accepted[0]?.toolTrace.map(({ action }) => action)).toEqual(['preview_scenario'])
    expect(h.state.accepted[0]?.constraintChecks).toHaveLength(4)
    expect(h.state.accepted[0]?.request.weights).toEqual(SIGNATURE_WEIGHTS)
  })

  it('executes focus, unpin, counterfactual, and discard tools in their valid states', async () => {
    const h = harness()
    let tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'focus_tradeoffs')!.execute({ stateVersion: 1, programs: ['housing'], districts: ['river_ward'], outcomes: ['mobility'] }, { signal: new AbortController().signal })
    expect(h.state.ui).toEqual({ selectedProgram: 'housing', selectedDistrict: 'river_ward', selectedOutcome: 'mobility' })

    h.environment.dispatch({ type: 'pin', programId: 'climate', value: 80, meta: { actor: 'human', action: 'pin', summary: 'pin climate' } })
    tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'unpin_program')!.execute({ stateVersion: 3, programId: 'climate' }, { signal: new AbortController().signal })
    expect(h.state.pins).toEqual({})

    h.environment.dispatch({ type: 'selectCoefficient', coefficientId: 'cf_housing_stability' })
    tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'test_assumption')!.execute({ stateVersion: 5, coefficientId: 'cf_housing_stability', suppressed: true }, { signal: new AbortController().signal })
    expect(h.state.suppressedCoefficients).toEqual(['cf_housing_stability'])

    tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'preview_scenario')!.execute({ stateVersion: 6, name: 'Discard me', weights: SIGNATURE_WEIGHTS, rationale: 'Discard' }, { signal: new AbortController().signal })
    tools = buildCivicTools(h.state, h.environment)
    await tools.find(({ name }) => name === 'discard_preview')!.execute({ stateVersion: 7 }, { signal: new AbortController().signal })
    expect(h.state.staged).toBeNull()
    expect(h.state.suppressedCoefficients).toEqual([])
  })

  it('returns the post-mutation state version', async () => {
    const h = harness()
    const tool = buildCivicTools(h.state, h.environment).find(({ name }) => name === 'preview_scenario')!
    const result = await tool.execute({ stateVersion: 1, name: 'Versioned', weights: SIGNATURE_WEIGHTS, rationale: 'Version check' }, { signal: new AbortController().signal })
    expect(result).toMatchObject({ status: 'feasible', stateVersion: 2 })
    expect(h.state.stateVersion).toBe(2)
  })
})
