import { SIGNATURE_WEIGHTS } from './model/fixtures'
import { solveScenario } from './engine/solve'
import { useCivicRuntime } from './state/useCivicRuntime'

export function App() {
  const { state, webMcpStatus } = useCivicRuntime()
  const signature = solveScenario({ weights: SIGNATURE_WEIGHTS, protectedPrograms: ['emergency'] })

  return (
    <main>
      <p className="eyebrow">Harbor City · model {state.modelVersion}</p>
      <h1>Civic</h1>
      <p className="lede">A transparent public-budget studio for people and browser agents.</p>
      <section aria-labelledby="core-status">
        <h2 id="core-status">Deterministic core</h2>
        <p>
          {signature.status === 'feasible'
            ? 'Ready. The reviewed signature request closes at exactly $100.0M.'
            : 'The fixture contract is not feasible.'}
        </p>
        <dl>
          <div><dt>State version</dt><dd>{state.stateVersion}</dd></div>
          <div><dt>WebMCP</dt><dd>{webMcpStatus}</dd></div>
          <div><dt>Agent tools</dt><dd>acceptance remains human-only</dd></div>
        </dl>
      </section>
      <p className="disclaimer">Harbor City is fictional. Outcome indices are illustrative, not forecasts.</p>
    </main>
  )
}
