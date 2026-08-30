import { useEffect, useMemo, useRef, useState } from 'react'
import { PushPin, PushPinSlash, CheckCircle, Warning } from '@phosphor-icons/react'
import { ResponsiveContainer, Sankey } from 'recharts'
import { calculateOutcomes } from './engine/outcomes'
import { solveScenario } from './engine/solve'
import { BASELINE_ALLOCATION, COEFFICIENTS, DISTRICTS, PROGRAMS, SIGNATURE_WEIGHTS, TOTAL_BUDGET } from './model/fixtures'
import { OUTCOME_IDS, PROGRAM_IDS } from './model/types'
import type { Allocation, DistrictId, OutcomeId, ProgramId } from './model/types'
import { stagedPinConflicts } from './state/civicState'
import type { CivicAction, CivicState, StagedScenario } from './state/civicState'
import { activityCounts, changeList, describeBaseline, describeDistrict, describeScenario, formatDelta, formatMoney, OUTCOME_LABELS } from './state/summaries'
import { useAnimatedAllocation } from './state/useAnimatedAllocation'
import { useCivicRuntime } from './state/useCivicRuntime'
import { civicToolNames } from './webmcp/tools'

const SIGNATURE_PINS: readonly ProgramId[] = ['climate', 'youth', 'libraries']

/** Below this width the flow diagram is hidden, so it must not be rendered into a zero-sized box. */
const NARROW_QUERY = '(max-width: 700px)'
function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY)
    const update = () => setNarrow(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return narrow
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
  const narrow = useNarrowViewport()
  const animated = useAnimatedAllocation(allocation)
  const sankeyData = useMemo(() => ({ nodes: [{ name: '$100M' }, ...PROGRAMS.map(({ label }) => ({ name: label }))], links: PROGRAMS.map((program, index) => ({ source: 0, target: index + 1, value: animated[program.id] })) }), [animated])
  return <section className="panel budget-panel" aria-labelledby="budget-heading">
    <p className="sr-only">{describeBaseline(state)}</p>
    <div className="panel-heading"><h2 id="budget-heading">Budget canvas</h2><div className="legend" aria-label="Chart legend"><span className="canonical-key">canonical</span><span className="staged-key">staged</span><span className="increase-key">increase</span><span className="decrease-key">decrease</span></div></div>
    <div className="budget-body"><div className="flow-total"><strong>{formatMoney(TOTAL_BUDGET)}</strong><span>Total · exact</span></div><div className="sankey-wrap" aria-hidden="true">{narrow ? null : <ResponsiveContainer width="100%" height="100%"><Sankey data={sankeyData} tabIndex={-1} role="presentation" nodePadding={9} nodeWidth={8} linkCurvature={0.55} iterations={12} node={{ fill: '#6c685f', stroke: 'none' }} link={{ fill: 'none', stroke: '#b7b2a5', strokeOpacity: 0.72 }} /></ResponsiveContainer>}</div>
      <div className="program-list">{PROGRAMS.map((program) => { const value = allocation[program.id]; const canonical = state.canonical[program.id]; const delta = value - canonical; const pinned = state.pins[program.id] !== undefined; return <div key={program.id} id={`program-${program.id}`} className={`program-row ${selectedProgram === program.id ? 'is-selected' : ''} ${state.focus.programs.includes(program.id) ? 'is-focused' : ''}`}>
        <button className={`pin-button ${pinned ? 'is-pinned' : ''}`} onClick={() => onTogglePin(program.id)} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${program.label}`} title={`${pinned ? 'Unpin' : 'Pin'} ${program.label}`}>{pinned ? <PushPinSlash size={15} weight="bold" /> : <PushPin size={15} />}</button>
        <button className="program-label" onClick={() => onSelectProgram(program.id)} aria-pressed={selectedProgram === program.id}><strong>{program.label}</strong><span>range {formatMoney(program.minimum)}–{formatMoney(program.maximum)} {program.id === 'libraries' ? '· not modeled' : ''}</span></button>
        <div className="allocation-bar" role="img" aria-label={`${program.label}: ${formatMoney(value)}${delta === 0 ? '' : `, ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta / 10).toFixed(1)} from ${formatMoney(canonical)}`}${pinned ? ', pinned' : ''}`}><span className="canonical-bar" style={{ width: `${canonical / 3}%` }} /><span className={`proposal-bar ${staged ? 'is-staged' : ''} ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`} style={{ width: `${animated[program.id] / 3}%` }} /></div>
        <strong className="program-value">{(value / 10).toFixed(1)}</strong><span className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}`} aria-hidden="true">{delta === 0 ? '—' : formatDelta(delta)}</span>
      </div>})}</div>
    </div>
  </section>
}

function DistrictOutcomes({ state, selectedOutcome, onSelectOutcome, selectedDistrict, onSelectDistrict }: { state: CivicState; selectedOutcome: OutcomeId; onSelectOutcome: (id: OutcomeId) => void; selectedDistrict: DistrictId | null; onSelectDistrict: (id: DistrictId | null) => void }) {
  const allocation = activeAllocation(state)
  const animated = useAnimatedAllocation(allocation)
  // Tiles move with the budget; the direction marker reads from the settled allocation so it cannot flicker mid-transition.
  const scores = calculateOutcomes(animated, new Set(state.suppressedCoefficients))
  const settledScores = calculateOutcomes(allocation, new Set(state.suppressedCoefficients))
  const baselineScores = calculateOutcomes(BASELINE_ALLOCATION)
  return <section className="panel district-panel" aria-labelledby="district-heading"><div className="panel-heading"><h2 id="district-heading">District outcomes</h2><span>index 0–100</span></div>
    <div className="outcome-tabs" role="tablist" aria-label="Outcome index">{OUTCOME_IDS.map((id) => <button key={id} role="tab" aria-selected={id === selectedOutcome} onClick={() => onSelectOutcome(id)}>{OUTCOME_LABELS[id]}</button>)}</div>
    <div className="district-grid">{DISTRICTS.map((district) => {
      const value = scores[district.id][selectedOutcome]; const delta = settledScores[district.id][selectedOutcome] - baselineScores[district.id][selectedOutcome]
      const movement = Math.abs(delta) < 0.05 ? 'no change' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}`
      const selected = selectedDistrict === district.id
      return <button key={district.id} className={`district-card ${selected ? 'is-selected' : ''} ${state.focus.districts.includes(district.id) ? 'is-focused' : ''}`} aria-pressed={selected} onClick={() => onSelectDistrict(selected ? null : district.id)}>
        <span>{district.label}</span><strong>{value.toFixed(1)}</strong><div className="score-track" aria-hidden="true"><span style={{ width: `${value}%` }} /></div><small>{movement}</small>
        <span className="sr-only">{describeDistrict(state, district.id, allocation)}</span>
      </button>
    })}</div>
    <p className="district-detail" aria-live="polite">{selectedDistrict ? describeDistrict(state, selectedDistrict, allocation) : 'Select a district for its four indices. No map interaction is required to read the scenario.'}</p>
  </section>
}

function ScenarioRail({ state, dispatch, onPinSignature, onSelectProgram }: { state: CivicState; dispatch: React.Dispatch<CivicAction>; onPinSignature: () => void; onSelectProgram: (id: ProgramId) => void }) {
  const result = state.staged?.result; const feasible = result?.status === 'feasible'; const signaturePinned = SIGNATURE_PINS.every((id) => state.pins[id] !== undefined)
  const changes = feasible ? changeList(state.canonical, result.allocation) : []
  const pinConflicts = stagedPinConflicts(state)
  const infeasibleMessage = result?.status !== 'infeasible'
    ? null
    : result.reason === 'minimum_total_exceeds_budget'
      ? <>Requested floors require <strong>{formatMoney(result.requiredTotal)}</strong> against {formatMoney(result.availableTotal)}.</>
      : result.reason === 'maximum_total_below_budget'
        ? <>Requested ceilings allow at most <strong>{formatMoney(result.maximumTotal)}</strong> against {formatMoney(result.availableTotal)}.</>
        : <><strong>{result.conflicts.length}</strong> requested {result.conflicts.length === 1 ? 'bound conflicts' : 'bounds conflict'} with the program limits.</>
  return <section className={`panel scenario-panel ${result?.status === 'infeasible' ? 'has-conflict' : ''}`} aria-labelledby="scenario-heading"><div className="panel-heading"><h2 id="scenario-heading">Scenario rail</h2><span className="state-chip">{result?.status ?? 'baseline'}</span></div>
    <div className="scenario-copy">{state.staged ? <><strong>{state.staged.intent.name}</strong><p>{state.staged.intent.rationale}</p></> : <p>No active request. State a goal through a WebMCP agent, or run one of the harness utterances.</p>}{infeasibleMessage ? <div className="conflict-summary"><Warning size={18} weight="fill" /><span>No plan. {infeasibleMessage}</span></div> : null}{pinConflicts.length > 0 ? <div className="conflict-summary"><Warning size={18} weight="fill" /><span>Pinned after this preview was solved. It contradicts {pinConflicts.length} {pinConflicts.length === 1 ? 'pin' : 'pins'} and cannot be accepted until the agent revises it.</span></div> : null}</div>
    <ul className="binding-list" aria-label={result?.status === 'infeasible' ? 'Binding constraints' : 'Change list'}>
      {result?.status === 'infeasible' ? result.conflicts.map((binding) => <li key={`${binding.programId}-${binding.cause}-${binding.relation}`}><button className="binding-chip" onClick={() => onSelectProgram(binding.programId)} title={binding.detail}><span aria-hidden="true">{binding.programId} {binding.relation === 'minimum' ? '≥' : binding.relation === 'maximum' ? '≤' : '='} {binding.detail.match(/\$[\d.]+M/)?.[0]}</span><span className="sr-only">{`${binding.detail}. Show this program.`}</span></button></li>) : null}
      {changes.map((change) => <li key={change.programId}><button className={`change-chip ${change.direction}`} onClick={() => onSelectProgram(change.programId)}><span aria-hidden="true">{change.programId} {change.direction === 'up' ? '▲' : '▼'} {formatDelta(change.delta)}</span><span className="sr-only">{`${change.label} ${change.direction === 'up' ? 'up' : 'down'} ${Math.abs(change.delta / 10).toFixed(1)} to ${formatMoney(change.to)}. Show this program.`}</span></button></li>)}
    </ul>
    <div className="scenario-actions"><button className="primary-button" disabled={!feasible || pinConflicts.length > 0} onClick={() => dispatch({ type: 'accept', id: crypto.randomUUID(), meta: { actor: 'human', action: 'accept', summary: 'accepted the staged scenario' } })}><CheckCircle size={16} /> Accept scenario</button><button className="quiet-button" disabled={!state.staged} onClick={() => dispatch({ type: 'discard', meta: { actor: 'human', action: 'discard', summary: 'discarded the staged scenario' } })}>Discard</button><button className="quiet-button" disabled={signaturePinned} onClick={onPinSignature}>{signaturePinned ? '3 values pinned' : 'Pin 3 human values'}</button><span>Human-only controls</span></div>
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

function AgentActivity({ state, webMcpStatus }: { state: CivicState; webMcpStatus: string }) {
  const names = civicToolNames(state)
  const { toolCalls, humanDecisions } = activityCounts(state)
  const registrationLabel = webMcpStatus === 'live' ? `${names.length} registered` : `${names.length} defined · WebMCP ${webMcpStatus}`
  return <section className="panel activity-panel" aria-labelledby="activity-heading"><div className="panel-heading"><h2 id="activity-heading">Agent activity</h2><span>{registrationLabel} · {toolCalls} tool {toolCalls === 1 ? 'call' : 'calls'} · {humanDecisions} human</span></div><div className="activity-body"><ol aria-label="Tool calls and human decisions, most recent last">{state.activity.length === 0 ? <li className="activity-empty"><p>No calls yet · v{state.stateVersion} · 8 programs, 6 districts, model {state.modelVersion} loaded and awaiting an agent.</p></li> : state.activity.slice(-5).map((entry) => <li key={entry.id}><code>{entry.action}</code><span>{entry.actor === 'tool' ? 'tool' : 'human'}</span><p>{entry.summary} · state v{entry.stateVersion}</p></li>)}</ol><aside><h3>Live tool surface</h3>{names.map((name) => <code key={name}>{name}</code>)}<h3>protectedPrograms enum</h3><p>{PROGRAM_IDS.filter((id) => state.pins[id] === undefined).map((id) => `“${id}”`).join(', ')}</p></aside></div></section>
}

function Inspector({ state, selectedProgram, dispatch }: { state: CivicState; selectedProgram: ProgramId | null; dispatch: React.Dispatch<CivicAction> }) {
  const program = PROGRAMS.find(({ id }) => id === selectedProgram); const coefficients = COEFFICIENTS.filter(({ programId }) => programId === selectedProgram); const receipt = state.accepted.at(-1); const [tab, setTab] = useState<'model' | 'receipt'>('model')
  return <section className="panel inspector-panel" aria-labelledby="inspector-heading"><div className="inspector-tabs"><button className={tab === 'model' ? 'active' : ''} onClick={() => setTab('model')} id="inspector-heading">Model inspector</button><button className={tab === 'receipt' ? 'active' : ''} onClick={() => setTab('receipt')}>Decision receipt</button></div>{tab === 'model' ? <div className="inspector-content">{program ? <><h3>{program.label}</h3><p>{formatMoney(program.baseline)} baseline · range {formatMoney(program.minimum)}–{formatMoney(program.maximum)}</p>
    {coefficients.length === 0 ? <div className="not-modeled"><strong>Not modeled</strong><p>No outcome index claims to capture what this program is worth. Its floor and human pin still bind every plan.</p></div> : coefficients.map((coefficient) => <button key={coefficient.id} className={state.selectedCoefficient === coefficient.id ? 'coefficient selected' : 'coefficient'} onClick={() => dispatch({ type: 'selectCoefficient', coefficientId: state.selectedCoefficient === coefficient.id ? null : coefficient.id })}><span>{OUTCOME_LABELS[coefficient.outcomeId]}</span><strong>{coefficient.value.toFixed(1)}</strong><small>{coefficient.confidence} confidence · {coefficient.provenance}</small></button>)}</> : <><h3>Harbor City model {state.modelVersion}</h3><p>{formatMoney(TOTAL_BUDGET)} fixed · $0.1M resolution · 30% default change cap</p><div className="not-modeled"><strong>Libraries are not modeled</strong><p>No index claims to capture their value. The $5.0M floor and human pin still bind every plan.</p></div></>}
    <dl><div><dt>Total allocation</dt><dd>exactly 100.0</dd></div><div><dt>Emergency floor</dt><dd>≥ $18.0M</dd></div><div><dt>Change cap</dt><dd>±30% baseline</dd></div><div><dt>Human pins</dt><dd>immutable to tools</dd></div></dl></div> : <div className="inspector-content receipt">{receipt ? (() => {
    const moved = changeList(receipt.from, receipt.allocation)
    const heldPins = PROGRAMS.filter((entry) => receipt.pins[entry.id] !== undefined)
    const relied = COEFFICIENTS.filter((coefficient) => moved.some((change) => change.programId === coefficient.programId))
    const weights = Object.entries(receipt.request.weights).map(([outcome, weight]) => `${outcome} ${(weight * 100).toFixed(0)}%`).join(', ')
    const protectedPrograms = receipt.request.protectedPrograms?.join(', ') || 'none'
    const targets = Object.entries(receipt.request.targets ?? {}).map(([program, target]) => {
      const parts = [target?.minimum === undefined ? null : `≥ ${formatMoney(target.minimum)}`, target?.maximum === undefined ? null : `≤ ${formatMoney(target.maximum)}`].filter(Boolean)
      return `${program} ${parts.join(' and ')}`
    }).join(', ') || 'none'
    return <><h3>{receipt.name}</h3><p>Accepted by a human · model {receipt.modelVersion} · state v{receipt.stateVersion}</p><p className="receipt-rationale">{receipt.rationale}</p>
      <strong>Request</strong>
      <dl><div><dt>Weights</dt><dd>{weights}</dd></div><div><dt>Protected</dt><dd>{protectedPrograms}</dd></div><div><dt>Firm targets</dt><dd>{targets}</dd></div></dl>
      <strong>Tool trace ({receipt.toolTrace.length})</strong>
      <dl>{receipt.toolTrace.length === 0 ? <div><dt>None recorded</dt><dd>local harness</dd></div> : receipt.toolTrace.map((entry) => <div key={entry.id}><dt>{entry.action}</dt><dd>state v{entry.stateVersion} · {entry.summary}</dd></div>)}</dl>
      <strong>Constraint checks ({receipt.constraintChecks.length})</strong>
      <ul>{receipt.constraintChecks.map((check) => <li key={check}>{check}</li>)}</ul>
      <strong>Programs moved ({moved.length})</strong>
      <dl>{moved.map((change) => <div key={change.programId}><dt>{change.label}</dt><dd>{formatMoney(change.from)} → {formatMoney(change.to)} ({change.direction === 'up' ? '↑' : '↓'} {formatDelta(change.delta)})</dd></div>)}<div><dt>Total</dt><dd>exactly {formatMoney(TOTAL_BUDGET)}</dd></div></dl>
      <strong>Human pins held ({heldPins.length})</strong>
      <dl>{heldPins.length === 0 ? <div><dt>None</dt><dd>no pins</dd></div> : heldPins.map((entry) => <div key={entry.id}><dt>{entry.label}</dt><dd>{formatMoney(receipt.pins[entry.id] as number)}</dd></div>)}</dl>
      <strong>Coefficients relied upon ({relied.length})</strong>
      <dl>{relied.map((coefficient) => <div key={coefficient.id}><dt>{coefficient.id}</dt><dd>{coefficient.value.toFixed(1)} · {coefficient.confidence}</dd></div>)}</dl>
      <small>{receipt.humanDecision}. No suppressed assumption can enter a receipt. Low-confidence coefficients remain disclosed in the model inspector.</small></>
  })() : <p>No accepted scenario yet. Only the labeled human control can create a receipt.</p>}</div>}</section>
}

/** Announce the staged scenario once per state version, so a screen reader hears what the agent just did. */
function ScenarioAnnouncer({ state }: { state: CivicState }) {
  const [message, setMessage] = useState('')
  const lastVersion = useRef(state.stateVersion)
  useEffect(() => {
    if (lastVersion.current === state.stateVersion) return
    lastVersion.current = state.stateVersion
    setMessage(describeScenario(state))
  }, [state])
  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>
}

export function App() {
  const { state, dispatch, webMcpStatus } = useCivicRuntime()
  const { selectedOutcome, selectedProgram, selectedDistrict } = state.ui
  const setSelectedOutcome = (selectedOutcome: OutcomeId) => dispatch({ type: 'setUiSelection', selection: { selectedOutcome } })
  const setSelectedProgram = (selectedProgram: ProgramId) => dispatch({ type: 'setUiSelection', selection: { selectedProgram } })
  const setSelectedDistrict = (selectedDistrict: DistrictId | null) => dispatch({ type: 'setUiSelection', selection: { selectedDistrict } })

  const togglePin = (programId: ProgramId) => state.pins[programId] !== undefined ? dispatch({ type: 'unpin', programId, meta: { actor: 'human', action: 'unpin', summary: `unpinned ${programId}` } }) : dispatch({ type: 'pin', programId, value: state.canonical[programId], meta: { actor: 'human', action: 'pin', summary: `pinned ${programId} at ${formatMoney(state.canonical[programId])}` } })
  const pinSignature = () => { for (const programId of SIGNATURE_PINS) if (state.pins[programId] === undefined) dispatch({ type: 'pin', programId, value: state.canonical[programId], meta: { actor: 'human', action: 'pin', summary: `pinned ${programId} at ${formatMoney(state.canonical[programId])}` } }) }
  const showProgram = (programId: ProgramId) => { setSelectedProgram(programId); document.getElementById(`program-${programId}`)?.scrollIntoView({ block: 'nearest' }) }
  const webMcpLive = webMcpStatus === 'live'
  return <main className="civic-app"><ScenarioAnnouncer state={state} /><p className="viewport-notice">Civic is built for a desktop browser at 1280×720 or wider. Below that the workspace stacks into one column, and on a phone-width screen the budget flow gives way to the program list, which carries the same numbers.</p><Header state={state} webMcpStatus={webMcpStatus} onReset={() => dispatch({ type: 'reset', meta: { actor: 'human', action: 'reset', summary: 'reset the demo' } })} /><div className="workspace-top"><BudgetCanvas state={state} selectedProgram={selectedProgram} onSelectProgram={setSelectedProgram} onTogglePin={togglePin} /><div className="right-top"><DistrictOutcomes state={state} selectedOutcome={selectedOutcome} onSelectOutcome={setSelectedOutcome} selectedDistrict={selectedDistrict} onSelectDistrict={setSelectedDistrict} /><ScenarioRail state={state} dispatch={dispatch} onPinSignature={pinSignature} onSelectProgram={showProgram} /></div></div><div className={`workspace-bottom ${webMcpLive ? 'webmcp-live' : ''}`}>{webMcpLive ? null : <Harness state={state} dispatch={dispatch} />}<AgentActivity state={state} webMcpStatus={webMcpStatus} /><Inspector state={state} selectedProgram={selectedProgram} dispatch={dispatch} /></div><footer>Harbor City is fictional. Outcome indices are illustrative arithmetic over disclosed coefficients, not forecasts or evidence of causation.</footer></main>
}
