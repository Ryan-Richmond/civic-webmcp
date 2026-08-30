import { describe, expect, it, vi } from 'vitest'
import { SIGNATURE_WEIGHTS } from '../model/fixtures'
import { civicReducer, createInitialState } from '../state/civicState'
import type { CivicAction, CivicState } from '../state/civicState'
import { buildCivicTools, registerCivicTools } from './tools'

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

  it('returns the post-mutation state version', async () => {
    const h = harness()
    const tool = buildCivicTools(h.state, h.environment).find(({ name }) => name === 'preview_scenario')!
    const result = await tool.execute({ stateVersion: 1, name: 'Versioned', weights: SIGNATURE_WEIGHTS, rationale: 'Version check' }, { signal: new AbortController().signal })
    expect(result).toMatchObject({ status: 'feasible', stateVersion: 2 })
    expect(h.state.stateVersion).toBe(2)
  })
})
