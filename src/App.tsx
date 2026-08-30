import { useMemo, useState } from 'react'
import { PushPin, PushPinSlash, CheckCircle, Warning } from '@phosphor-icons/react'
import { ResponsiveContainer, Sankey } from 'recharts'
import { calculateOutcomes } from './engine/outcomes'
import { solveScenario } from './engine/solve'
import { BASELINE_ALLOCATION, COEFFICIENTS, DISTRICTS, PROGRAMS, SIGNATURE_WEIGHTS, TOTAL_BUDGET } from './model/fixtures'
import { OUTCOME_IDS, PROGRAM_IDS } from './model/types'
import type { Allocation, OutcomeId, ProgramId } from './model/types'
import type { CivicAction, CivicState, StagedScenario } from './state/civicState'
import { useCivicRuntime } from './state/useCivicRuntime'

const OUTCOME_LABELS: Record<OutcomeId, string> = {
  stability: 'Household Stability', mobility: 'Access and Mobility', safety: 'Safety and Resilience', opportunity: 'Opportunity and Inclusion',
}
const SIGNATURE_PINS: readonly ProgramId[] = ['climate', 'youth', 'libraries']
const formatMoney = (tenths: number) => `$${(tenths / 10).toFixed(1)}M`

function toolNames(state: CivicState) {
  const names = ['get_civic_state', 'get_model_details', 'focus_tradeoffs', state.staged ? 'revise_scenario' : 'preview_scenario']
  if (state.staged) names.push('compare_scenarios', 'discard_preview')
  if (Object.keys(state.pins).length > 0) names.push('unpin_program')
  if (state.selectedCoefficient) names.push('test_assumption')
  return names
}

const activeAllocation = (state: CivicState): Allocation => state.staged?.result.status === 'feasible' ? state.staged.result.allocation : state.canonical

function Header({ state, webMcpStatus, onReset }: { state: CivicState; webMcpStatus: string; onReset: () => void }) {
  return <header className="app-header">
    <div className="brand-lockup"><div><strong>Civic</strong><span>Public budget<br />studio</span></div><p>Harbor City · annual discretionary budget<br /><span>{formatMoney(TOTAL_BUDGET)} · 8 programs · 6 districts · model {state.modelVersion} · state v{state.stateVersion}</span></p></div>
    <div className="header-status"><span className="direction-chip">A · Instrument</span><span className="fiction-chip">Fictional city · illustrative model · not a policy forecast</span><span className={`mcp-chip mcp-${webMcpStatus}`}>WebMCP {webMcpStatus}</span><button className="quiet-button" onClick={onReset}>Reset demo</button></div>
  </header>
}

function BudgetCanvas({ state, selectedProgram, onSelectProgram, onTogglePin }: { state: CivicState; selectedProgram: ProgramId | null; onSelectProgram: (id: ProgramId) => void; onTogglePin: (id: ProgramId) => void }) {
  const allocation = activeAllocation(state)
  const staged = state.staged?.result.status === 'feasible'
  const sankeyData = useMemo(() => ({ nodes: [{ name: '$100M' }, ...PROGRAMS.map(({ label }) => ({ name: label }))], links: PROGRAMS.map((program, index) => ({ source: 0, target: index + 1, value: allocation[program.id] })) }), [allocation])
  return <section className="panel budget-panel" aria-labelledby="budget-heading">
    <div className="panel-heading"><h2 id="budget-heading">Budget canvas</h2><div className="legend" aria-label="Chart legend"><span className="canonical-key">canonical</span><span className="staged-key">staged</span><span className="increase-key">increase</span><span className="decrease-key">decrease</span></div></div>
    <div className="budget-body"><div className="flow-total"><strong>{formatMoney(TOTAL_BUDGET)}</strong><span>Total · exact</span></div><div className="sankey-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height="100%"><Sankey data={sankeyData} nodePadding={9} nodeWidth={8} linkCurvature={0.55} iterations={12} node={{ fill: '#6c685f', stroke: 'none' }} link={{ fill: 'none', stroke: '#b7b2a5', strokeOpacity: 0.72 }} /></ResponsiveContainer></div>
      <div className="program-list">{PROGRAMS.map((program) => { const value = allocation[program.id]; const canonical = state.canonical[program.id]; const delta = value - canonical; const pinned = state.pins[program.id] !== undefined; return <div key={program.id} className={`program-row ${selectedProgram === program.id ? 'is-selected' : ''}`}>
        <button className={`pin-button ${pinned ? 'is-pinned' : ''}`} onClick={() => onTogglePin(program.id)} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${program.label}`} title={`${pinned ? 'Unpin' : 'Pin'} ${program.label}`}>{pinned ? <PushPinSlash size={15} weight="bold" /> : <PushPin size={15} />}</button>
        <button className="program-label" onClick={() => onSelectProgram(program.id)} aria-pressed={selectedProgram === program.id}><strong>{program.label}</strong><span>range {formatMoney(program.minimum)}–{formatMoney(program.maximum)} {program.id === 'libraries' ? '· not modeled' : ''}</span></button>
        <div className="allocation-bar" aria-label={`${program.label}: ${formatMoney(value)}`}><span className="canonical-bar" style={{ width: `${canonical / 3}%` }} />{staged ? <span className={`proposal-bar ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`} style={{ width: `${value / 3}%` }} /> : null}</div>
        <strong className="program-value">{(value / 10).toFixed(1)}</strong><span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`}>{delta === 0 ? '—' : `${delta > 0 ? '+' : '−'}${Math.abs(delta / 10).toFixed(1)}`}</span>
      </div>})}</div>
    </div>
  </section>
}

function DistrictOutcomes({ state, selectedOutcome, onSelectOutcome }: { state: CivicState; selectedOutcome: OutcomeId; onSelectOutcome: (id: OutcomeId) => void }) {
  const scores = calculateOutcomes(activeAllocation(state), new Set(state.suppressedCoefficients)); const baselineScores = calculateOutcomes(BASELINE_ALLOCATION)
  return <section className="panel district-panel" aria-labelledby="district-heading"><div className="panel-heading"><h2 id="district-heading">District outcomes</h2><span>index 0–100</span></div>
    <div className="outcome-tabs" role="tablist" aria-label="Outcome index">{OUTCOME_IDS.map((id) => <button key={id} role="tab" aria-selected={id === selectedOutcome} onClick={() => onSelectOutcome(id)}>{OUTCOME_LABELS[id]}</button>)}</div>
    <div className="district-grid">{DISTRICTS.map((district) => { const value = scores[district.id][selectedOutcome]; const delta = value - baselineScores[district.id][selectedOutcome]; return <button key={district.id} className="district-card"><span>{district.label}</span><strong>{value.toFixed(1)}</strong><div className="score-track"><span style={{ width: `${value}%` }} /></div><small>{delta === 0 ? 'no change' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}`}</small></button> })}</div>
  </section>
}

function ScenarioRail({ state, dispatch, onPinSignature }: { state: CivicState; dispatch: React.Dispatch<CivicAction>; onPinSignature: () => void }) {
  const result = state.staged?.result; const feasible = result?.status === 'feasible'; const signaturePinned = SIGNATURE_PINS.every((id) => state.pins[id] !== undefined)
  return <section className={`panel scenario-panel ${result?.status === 'infeasible' ? 'has-conflict' : ''}`} aria-labelledby="scenario-heading" aria-live="polite"><div className="panel-heading"><h2 id="scenario-heading">Scenario rail</h2><span className="state-chip">{result?.status ?? 'baseline'}</span></div>
    <div className="scenario-copy">{state.staged ? <><strong>{state.staged.intent.name}</strong><p>{state.staged.intent.rationale}</p></> : <p>No active request. State a goal through a WebMCP agent, or run one of the harness utterances.</p>}{result?.status === 'infeasible' ? <div className="conflict-summary"><Warning size={18} weight="fill" /><span>No plan. Requested floors require <strong>{formatMoney(result.requiredTotal)}</strong> against {formatMoney(result.availableTotal)}.</span></div> : null}</div>
    <div className="binding-list">{result?.status === 'infeasible' ? result.conflicts.map((binding) => <span key={`${binding.programId}-${binding.cause}`} title={binding.detail}>{binding.programId} {binding.cause === 'target' ? '≥' : '='} {binding.detail.match(/\$[\d.]+M/)?.[0]}</span>) : null}</div>
    <div className="scenario-actions"><button className="primary-button" disabled={!feasible} onClick={() => dispatch({ type: 'accept', id: crypto.randomUUID(), meta: { actor: 'human', action: 'accept', summary: 'accepted the staged scenario' } })}><CheckCircle size={16} /> Accept scenario</button><button className="quiet-button" disabled={!state.staged} onClick={() => dispatch({ type: 'discard', meta: { actor: 'human', action: 'discard', summary: 'discarded the staged scenario' } })}>Discard</button><button className="quiet-button" disabled={signaturePinned} onClick={onPinSignature}>{signaturePinned ? '3 values pinned' : 'Pin 3 human values'}</button><span>Human-only controls</span></div>
  </section>
}

function Harness({ state, dispatch }: { state: CivicState; dispatch: React.Dispatch<CivicAction> }) {
  const stage = (name: string, rationale: string, request: StagedScenario['intent']['request']) => { const result = solveScenario({ ...request, canonical: state.canonical, pins: state.pins }); dispatch({ type: 'stage', scenario: { intent: { name, rationale, request }, result }, meta: { actor: 'tool', action: state.staged ? 'revise_scenario' : 'preview_scenario', summary: result.status === 'feasible' ? 'staged a feasible proposal' : `returned no plan at ${formatMoney(result.requiredTotal)}` } }) }
  const allPinned = SIGNATURE_PINS.every((id) => state.pins[id] !== undefined)
  return <section className="harness" aria-labelledby="harness-heading"><div className="panel-heading"><h2 id="harness-heading">Agent harness</h2><span>local stand-in</span></div><p>These utterances call the same engine as WebMCP. The engine owns all allocation arithmetic.</p>
    <button onClick={() => stage('Housing and access first', 'Weight stability and mobility; hold emergency response.', { weights: SIGNATURE_WEIGHTS, protectedPrograms: ['emergency'] })}>“Reduce housing instability and improve access to jobs. Do not cut emergency response.”<small>get_model_details → preview_scenario → focus_tradeoffs</small></button>
    <button disabled={!allPinned} onClick={() => stage('Firm targets', 'Human stated firm dollar floors.', { weights: SIGNATURE_WEIGHTS, targets: { housing: { minimum: 280 }, transit: { minimum: 220 } } })}>“Keep parks, youth and libraries exactly where they are. Housing 28, transit 22.”<small>{allPinned ? 'revise_scenario · expect no plan' : 'Pin the three human values first'}</small></button>
    <button disabled={!allPinned} onClick={() => stage('Within the pins', 'Targets dropped; weights allocate as far as pins allow.', { weights: SIGNATURE_WEIGHTS })}>“Drop the hard targets. Prioritize housing and transit as far as the pins allow.”<small>revise_scenario · weights only</small></button>
  </section>
}

function AgentActivity({ state }: { state: CivicState }) {
  const names = toolNames(state)
  return <section className="panel activity-panel" aria-labelledby="activity-heading"><div className="panel-heading"><h2 id="activity-heading">Agent activity</h2><span>{names.length} registered · {state.activity.length + 1} calls</span></div><div className="activity-body"><ol><li><code>get_civic_state</code><span>read</span><p>baseline loaded · v1 · 8 programs, 6 districts, model {state.modelVersion}</p></li>{state.activity.slice(-4).map((entry) => <li key={entry.id}><code>{entry.action}</code><span>{entry.actor}</span><p>{entry.summary} · v{entry.id}</p></li>)}</ol><aside><h3>Live tool surface</h3>{names.map((name) => <code key={name}>{name}</code>)}<h3>protectedPrograms enum</h3><p>{PROGRAM_IDS.filter((id) => state.pins[id] === undefined).map((id) => `“${id}”`).join(', ')}</p></aside></div></section>
}

function Inspector({ state, selectedProgram, dispatch }: { state: CivicState; selectedProgram: ProgramId | null; dispatch: React.Dispatch<CivicAction> }) {
  const program = PROGRAMS.find(({ id }) => id === selectedProgram); const coefficients = COEFFICIENTS.filter(({ programId }) => programId === selectedProgram); const receipt = state.accepted.at(-1); const [tab, setTab] = useState<'model' | 'receipt'>('model')
  return <section className="panel inspector-panel" aria-labelledby="inspector-heading"><div className="inspector-tabs"><button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')} id="inspector-heading">Model inspector</button><button className={tab === 'receipt' ? 'active' : ''} onClick={() => setTab('receipt')}>Decision receipt</button></div>{tab === 'model' ? <div className="inspector-content">{program ? <><h3>{program.label}</h3><p>{formatMoney(program.baseline)} baseline · range {formatMoney(program.minimum)}–{formatMoney(program.maximum)}</p>
    {coefficients.length === 0 ? <div className="not-modeled"><strong>Not modeled</strong><p>No outcome index claims to capture what this program is worth. Its floor and human pin still bind every plan.</p></div> : coefficients.map((coefficient) => <button key={coefficient.id} className={state.selectedCoefficient === coefficient.id ? 'coefficient selected' : 'coefficient'} onClick={() => dispatch({ type: 'selectCoefficient', coefficientId: state.selectedCoefficient === coefficient.id ? null : coefficient.id })}><span>{OUTCOME_LABELS[coefficient.outcomeId]}</span><strong>{coefficient.value.toFixed(1)}</strong><small>{coefficient.confidence} confidence · {coefficient.provenance}</small></button>)}</> : <><h3>Harbor City model {state.modelVersion}</h3><p>{formatMoney(TOTAL_BUDGET)} fixed · $0.1M resolution · 30% default change cap</p><div className="not-modeled"><strong>Libraries are not modeled</strong><p>No index claims to capture their value. The $5.0M floor and human pin still bind every plan.</p></div></>}
    <dl><div><dt>Total allocation</dt><dd>exactly 100.0</dd></div><div><dt>Emergency floor</dt><dd>≥ $18.0M</dd></div><div><dt>Change cap</dt><dd>±30% baseline</dd></div><div><dt>Human pins</dt><dd>immutable to tools</dd></div></dl></div> : <div className="inspector-content receipt">{receipt ? <><h3>{receipt.name}</h3><p>Accepted by a human · model {receipt.modelVersion}</p><strong>Canonical allocation updated</strong><p>{receipt.rationale}</p><small>Low-confidence assumptions remain disclosed in the model inspector.</small></> : <p>No accepted scenario yet. Only the labeled human control can create a receipt.</p>}</div>}</section>
}

export function App() {
  const { state, dispatch, webMcpStatus } = useCivicRuntime(); const [selectedOutcome, setSelectedOutcome] = useState<OutcomeId>('stability'); const [selectedProgram, setSelectedProgram] = useState<ProgramId | null>(null)
  const togglePin = (programId: ProgramId) => state.pins[programId] !== undefined ? dispatch({ type: 'unpin', programId, meta: { actor: 'human', action: 'unpin', summary: `unpinned ${programId}` } }) : dispatch({ type: 'pin', programId, value: state.canonical[programId], meta: { actor: 'human', action: 'pin', summary: `pinned ${programId} at ${formatMoney(state.canonical[programId])}` } })
  const pinSignature = () => { for (const programId of SIGNATURE_PINS) if (state.pins[programId] === undefined) dispatch({ type: 'pin', programId, value: state.canonical[programId], meta: { actor: 'human', action: 'pin', summary: `pinned ${programId} at ${formatMoney(state.canonical[programId])}` } }) }
  return <main className="civic-app"><Header state={state} webMcpStatus={webMcpStatus} onReset={() => dispatch({ type: 'reset', meta: { actor: 'human', action: 'reset', summary: 'reset the demo' } })} /><div className="workspace-top"><BudgetCanvas state={state} selectedProgram={selectedProgram} onSelectProgram={setSelectedProgram} onTogglePin={togglePin} /><div className="right-top"><DistrictOutcomes state={state} selectedOutcome={selectedOutcome} onSelectOutcome={setSelectedOutcome} /><ScenarioRail state={state} dispatch={dispatch} onPinSignature={pinSignature} /></div></div><div className="workspace-bottom"><Harness state={state} dispatch={dispatch} /><AgentActivity state={state} /><Inspector state={state} selectedProgram={selectedProgram} dispatch={dispatch} /></div><footer>Harbor City is fictional. Outcome indices are illustrative arithmetic over disclosed coefficients, not forecasts or evidence of causation.</footer></main>
}
