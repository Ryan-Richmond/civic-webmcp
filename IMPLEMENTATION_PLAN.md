# Civic implementation plan

Status: Active  
Date: 2026-08-29

## Source-of-truth hierarchy

1. `PRD.md` owns product scope, human-agent boundaries, acceptance criteria, and stop rules.
2. `SPEC.md` owns fixtures, engine behavior, state contracts, visual encodings, and the demo storyboard.
3. This plan owns build order and verification gates.
4. Executable tests are the proof that the implementation matches the contracts.

`ALIGNMENT.md` is historical reconciliation. Its adopted decisions must live in the PRD or spec rather than being reinterpreted during implementation.

## Frozen implementation decisions

- React and TypeScript client, built with Vite and deployable as static assets.
- Vercel is the preferred first host; Cloudflare Pages remains a sponsor-aligned fallback.
- Chrome's current imperative WebMCP API is the browser contract.
- WebMCP tools register with `document.modelContext.registerTool()` and unregister through an `AbortController` signal.
- `webmcp-types` supplies the TypeScript browser surface.
- All budget arithmetic is internal integer tenths of a million dollars.
- The engine constructs allocations directly on the 0.1M grid; it never claims a rounding pass that did not occur.
- Applicable WebMCP calls carry `stateVersion`; stale calls return structured recovery instructions.
- The public schema field is `protectedPrograms`.
- Direction A, Instrument, is the implementation target after the final visual-selection gate. Direction B contributes canonical-outline and activity-rail ideas only.

## Defects found and fixed during verification

- **Pins did not bind an already-staged preview.** A preview solved before a human pin could be accepted, producing
  a canonical allocation and a receipt that contradicted the pin. `stagedPinConflicts` now blocks acceptance in the
  reducer and in the UI, the rail and the screen-reader summary explain why, and a revision that respects the pin
  clears it. Covered by tests in `src/state/summaries.test.ts`.
- **The decision receipt was not auditable.** It named the scenario but not what moved, which pins held, or which
  coefficients it relied on, and the pre-acceptance allocation was not retained, so it could not be reconstructed.
  `AcceptedScenario` now stores `from`, `pins`, and `stateVersion`; persisted receipts in the older shape are rejected.
- **The activity rail counted human decisions as agent tool calls** and opened with a hardcoded `get_civic_state`
  entry that no agent had made. Counts are now split, and the empty state is labeled as page state.
- **The rail's tool list was a second implementation of the registration rules.** It now reads `civicToolNames`,
  the same builder the runtime registers, with a test pinning them together.
- **`focus_tradeoffs` moved nothing.** Agent focus now drives the selected program, district, and outcome.
- **The primary state tool did not satisfy its own contract.** `get_civic_state` now returns baseline and model
  versions, compact canonical and staged state, the latest accepted scenario, pins, human UI selection, and agent
  focus. Human selections live in versioned Civic state rather than inaccessible component-local state.
- **Read calls and receipts were not fully auditable.** Read-only tools now create activity entries without changing
  `stateVersion`; accepted receipts retain the structured request, complete tool trace, constraint checks, deltas,
  pins, coefficients, and explicit human decision.
- **Maximum targets could fail without naming a conflict.** Upper-bound target conflicts now carry a maximum
  relation, render with a `≤` indicator, and have a regression test.
- **Tool outputs exceeded current Chrome guidance.** State, model, comparison, and mutation results now use compact
  agent-facing shapes, with tests enforcing the 1,500-character budget.
- **The fallback harness competed with WebMCP.** It remains available in unsupported browsers, but disappears when
  the browser contract is live so the registered tools and their activity trail become the primary lower workspace.
- **Version-only updates churned the entire WebMCP registration.** A long in-app run eventually exceeded the
  browser's supported configuration lifecycle. Tool schemas now accept the current positive `stateVersion` and
  execution still rejects stale calls. The three stable core tools register once; only the dynamic scenario group
  re-registers when names or schemas actually change.

## Open review decisions

- **Resolved:** Implement Direction A, Instrument, and amend the product record to accept the two explored directions.
- **Resolved:** Mark Libraries and Digital Access explicitly `not modeled` and remove its outcome coefficients.
- **Resolved:** Use Vercel for the first preview deployment and WebMCP browser test.

## Work packages

### 1. Foundation and deterministic core — complete locally

- Scaffold the static React/TypeScript application.
- Encode Harbor City fixtures as reviewed TypeScript.
- Implement effective bounds, feasibility, greedy allocation, outcome calculation, and suppression masks as pure functions.
- Add unit and property tests for every numerical invariant.

Gate passed: `npm run check` passes and the signature request produces the expected allocation and $112.4M conflict.

### 2. Versioned application state — complete locally

- Implement canonical, staged, infeasible, accepted, discarded, and reset states.
- Preserve pins across revisions and accepted scenarios.
- Record typed tool and human activity separately.
- Persist accepted scenarios and user preferences locally.

Gate passed: reducer tests prove staged/canonical separation, stale-version rejection, persistence round trips, and suppression clearing.

### 3. WebMCP boundary — in-app round trip passed on the PR production build

- Register always-available read and focus tools.
- Swap `preview_scenario` for revise/compare/discard tools based on preview state.
- Narrow `protectedPrograms` whenever pins change.
- Register `unpin_program` and `test_assumption` only in their valid states.
- Use one abort controller per registration generation so lifecycle changes do not leave duplicate tools.

Gate passed: contract tests prove the exact tool set and schemas for baseline, staged, pinned, and coefficient-selected states. A fresh in-app browser run against the exact PR production build completed the signature flow and retained WebMCP after acceptance.

### 4. Instrument interface

- Build the 1280x720 composition without editor zoom.
- Render synchronized budget flows, program rows, district tiles, scenario rail, activity, inspector, and receipt.
- Keep the local harness behind a developer/demo affordance.

Gate: the complete manual signature flow works without WebMCP.

### 5. Accessibility and browser verification — local and in-app gates passed

- Provide semantic controls, keyboard navigation, visible focus, screen-reader summaries, and generous interaction targets.
- Honor `prefers-reduced-motion` and show a textual change list.
- Verify 1280x720 and 1440x900.
- Run the flow in ChatGPT's in-app browser and sponsor-aligned Chrome testing.

Local gate passed on 2026-08-29. Measured in the browser at the required viewports: every control is a native
button with an accessible name, no control is smaller than 24x24 CSS px, no focusable element sits inside an
`aria-hidden` region, the page overflows neither axis at 1280x720 or 1440x900, and the workspace stacks with an
explicit notice below 1050px. Evidence and the two deliberate deviations are recorded in `design-qa.md`.

Target size: the plan originally said 44px. **Recommendation adopted: conform to WCAG 2.2 AA Target Size
(Minimum), 24x24, and stop chasing 44.** 44px is WCAG 2.1 AAA / touch-platform guidance sized for a fingertip;
Civic is a desktop pointer-and-keyboard workspace whose stated demo target is the desktop in-app browser, so AA
plus generous spacing is the right bar. Chasing 44 uniformly would cost the single-screen composition that makes
the product legible, which is a bad trade for a criterion that does not apply to the input device.

Every control now meets 24x24. Program rows were raised from 38px to 40px, the most the 1280x720 layout allows
(eight rows at 40px exactly fill the 321px program list), so pin buttons and program labels are 39-40px tall.
District tiles are 56px. If a touch target is ever needed, the existing stacked layout below 1050px already has
the vertical room for 44px+, and that is where it belongs.

The secure deployed origin is Ready. The exact PR production build also passed a fresh ChatGPT in-app WebMCP test;
the canonical production alias is rechecked after merge.

### 5b. Motion — complete locally

- Flow transitions implemented to the `SPEC.md` section 4 parameters: 500ms ease-out, 40ms stagger in descending
  magnitude, reduced motion swaps immediately and falls back to the change list.
- Driven by easing the allocation rather than the DOM, because Recharts remounts its Sankey paths on every data
  change and CSS transitions cannot survive a remount. The flow, the bars, and the district tiles share one clock,
  satisfying PRD section 11.4.
- Numbers, deltas, and screen-reader summaries read the settled allocation, never an in-flight frame.
- The transition is skipped while the page is hidden, so a scenario staged by an agent against a backgrounded
  in-app browser cannot leave a stale flow diagram.

Gate passed: five timing tests plus browser verification of the wiring. Watching the motion on screen remains a
human check; the automation pane keeps the document hidden, which pauses `requestAnimationFrame`.

### 6. Submission package — repository and deployment live; recording and submission pending

- Deploy the approved candidate.
- Capture baseline, proposal, pins, infeasibility, recovery, and receipt screenshots.
- Record the 150-second walkthrough.
- Publish the repository and submission materials only after explicit approval. **Repository published with approval
  at `https://github.com/Ryan-Richmond/civic-webmcp`; submission materials remain draft.**

Complete: `npm run capture` builds the app, serves it, drives a real Chrome through the whole signature flow,
and writes the six required states to `audit/submission/` at 1280x720 CSS px, 2x scale. It asserts on the page's
own text at every step, so a drifted UI fails the run rather than producing screenshots of the wrong thing, and
it fails on any console error or failed request. `SUBMISSION.md` holds the Devpost text, the WebMCP testing
instructions, and the 150-second shot list. `vercel.json` is deployed at `https://civic-webmcp.vercel.app`; Vercel
reports Ready and the linked project's production branch is `main`.

Fixed while capturing: the page had no icon link, so every browser requested `/favicon.ico` and got a 404. That
is a console error on the deployed origin, which PRD section 20 forbids. Now an inline data-URI icon that cannot
404.

#### PRD section 20 acceptance status

Settled by test or measurement:

- Signature prompt produces a feasible staged scenario, every run. Engine is pure, so determinism is asserted too.
- Pinning Climate and Parks produces a visibly different revision, and the money visibly comes from elsewhere.
- Every generated scenario satisfies all numerical invariants (property suite).
- No agent tool can accept a scenario.
- The activity log distinguishes read, staged, discarded, and human-accepted, and only the human action creates
  a receipt or changes the canonical allocation.
- Solver returns in **0.004ms median, 0.009ms worst** over 50 runs, against a 500ms budget.
- Visual state updates **14ms** after the click, against a 200ms budget.
- No uncaught console errors or failed requests during the demo flow.
- Repository contains source, instructions, and a visible MIT license.

Still open, and not closable locally:

- ChatGPT discovers the expected tools from a fresh in-app browser session. **Passed against the exact PR production build.**
- A fresh user identifies the largest three baseline programs in under 30 seconds. **Needs a human observer.**
- A user identifies a gain and a loss without agent prose. **Needs a human observer.**
- The recorded walkthrough fits 150 seconds. Script is written to 150s; **needs the recording.**

#### Evidence record correction

The earlier `design-qa.md` statement claiming a real in-app round trip could not be reconciled with the local
evidence and was removed. Runtime and contract automation prove registration behavior against an injected browser
contract, and a fresh in-app run against the exact PR production build now closes the agent-interaction gate.
