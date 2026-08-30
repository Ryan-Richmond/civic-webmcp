# Civic Product Requirements Document

Status: Draft v0.1  
Date: 2026-08-29  
Owner: Ryan Richmond  
Target: OpenAI WebMCP Challenge submission  
Submission deadline: 2026-09-03 at 1:00 p.m. PT / 4:00 p.m. ET  
Internal submission target: 2026-09-03 at 12:00 p.m. ET

## 1. Product summary

**Civic is a WebMCP-enabled public-budget studio where a person and an agent build, inspect, and compare transparent budget scenarios for a fictional city.**

The human sets values and non-negotiable constraints. The agent translates those goals into structured scenario requests. Civic's deterministic constraint engine performs the arithmetic, rejects infeasible plans, calculates illustrative outcomes, and updates the page. The user sees every tradeoff through animated budget flows, a district map, outcome changes, and an action receipt before accepting a scenario.

The product is not a chatbot attached to a dashboard. The shared visual workspace is the product. ChatGPT or another WebMCP-aware browser agent collaborates with the user by operating structured tools inside the live page.

## 2. Product thesis

Public-budget choices are difficult to understand because spreadsheets hide tradeoffs, summaries omit constraints, and generative answers can sound plausible without being mathematically feasible. A browser page with a transparent model can guarantee consistency, while an agent can help a person express goals, explore alternatives, and interrogate consequences.

Civic should make one idea immediately visible:

> Every priority has a cost, every constraint changes the feasible choices, and every agent proposal should remain inspectable and reversible.

## 3. Challenge positioning

Civic is designed around the four official judging criteria:

| Criterion | Civic response |
|---|---|
| WebMCP leverage | The agent reads live page state, invokes a deterministic scenario engine, focuses visual tradeoffs, and stages revisions inside the page. Tool availability changes with scenario state. |
| Execution | One complete workflow runs from baseline budget through agent proposal, human correction, visual comparison, acceptance, and receipt. |
| Potential impact | Residents, facilitators, students, and policy teams can understand constrained choices without reading a spreadsheet or trusting unsupported generated arithmetic. |
| Creativity and ambition | Animated money flows, district-level effects, reversible scenario staging, and transparent model inspection turn agent reasoning into a visible civic deliberation. |

Challenge requirements and current WebMCP guidance are recorded in Section 21.

## 4. Goals

### 4.1 Product goals

1. Let a first-time user understand the baseline city budget in under 30 seconds.
2. Let a user state a policy goal in natural language through a WebMCP-aware agent.
3. Produce a mathematically feasible scenario without relying on the language model for arithmetic.
4. Make the scenario's funding sources, beneficiaries, losses, constraints, and assumptions visually obvious.
5. Let the user pin or protect a program and ask the agent to revise the scenario.
6. Require explicit human acceptance before a staged scenario becomes part of the comparison set.
7. Preserve a concise receipt showing the request, tool calls, model version, constraint checks, deltas, and human decision.
8. Deliver a coherent demonstration in less than 150 seconds.

### 4.2 Challenge goals

1. Demonstrate non-trivial imperative WebMCP tools in ChatGPT's in-app browser.
2. Show at least one dynamic tool lifecycle change based on page state.
3. Show at least one failed or infeasible proposal recovering cleanly.
4. Pass a repeatable prompt evaluation suite before recording the demo.
5. Publish a working live URL, public source repository, open-source license, setup instructions, and public YouTube demo under three minutes.

## 5. Non-goals

The challenge version will not:

- predict real policy outcomes;
- use real municipal, demographic, electoral, or non-public government data;
- recommend how a real city should allocate funds;
- claim that an illustrative score represents causal evidence;
- support authentication, teams, comments, payments, or multi-user collaboration;
- import arbitrary spreadsheets or connect to government systems;
- include an embedded chatbot or require an OpenAI API key;
- allow an agent to accept or publish a scenario on the user's behalf;
- optimize across hundreds of programs or simulate multi-year fiscal policy;
- become an ongoing product lane automatically after the challenge.

## 6. Target users

### 6.1 Primary challenge persona

**Maya, a curious resident**

- Wants to understand why a seemingly simple budget request requires tradeoffs.
- Has clear values but does not know municipal budget structures.
- Needs visual feedback and plain-language explanations.
- Wants control over non-negotiable services.

### 6.2 Secondary personas

- **Public meeting facilitator:** compares alternatives while keeping constraints visible.
- **Civics educator:** demonstrates scarcity, tradeoffs, and competing priorities.
- **Policy analyst:** pressure-tests a transparent illustrative model without accepting generated arithmetic on faith.

The submission should optimize for Maya. The other personas support the impact narrative but do not add MVP requirements.

## 7. Product principles

1. **The page remains primary.** The agent augments the visible experience rather than replacing it with prose.
2. **Deterministic math, agent-assisted intent.** The agent expresses objectives; Civic validates totals, constraints, and outcomes.
3. **No invisible writes.** Agent mutations create a staged preview. Only a human control can accept it.
4. **Show the cost of every gain.** Improvements must reveal where money came from and which outcomes declined.
5. **Assumptions stay inspectable.** Every score links to its formula, coefficients, and model disclaimer.
6. **Fictional data is labeled.** The app never implies that Harbor City or its outcomes are real.
7. **Motion explains state.** Animation must show where funds move and what changes, not merely decorate the interface.
8. **Failure is useful.** Infeasible requests should teach the user which constraints conflict and what could change.

## 8. Demo city and budget model

### 8.1 Fictional setting

The MVP uses **Harbor City**, a clearly fictional city with six districts:

- North Harbor
- East Junction
- River Ward
- Central
- South Point
- West Hills

The annual discretionary budget is exactly **$100 million**. This round number keeps the visual and verbal story legible.

### 8.2 Baseline programs

Dollar values below are millions.

| Program | Baseline | Minimum | Maximum | Primary illustrative outcomes |
|---|---:|---:|---:|---|
| Housing Stability | 15 | 8 | 30 | Household stability, inclusion |
| Transit and Access | 14 | 8 | 25 | Mobility, inclusion |
| Emergency Response | 20 | 18 | 25 | Safety, resilience |
| Public Health | 11 | 7 | 20 | Wellbeing, inclusion |
| Youth and Learning | 14 | 8 | 22 | Opportunity, inclusion |
| Climate and Parks | 8 | 4 | 16 | Resilience, wellbeing |
| Libraries and Digital Access | 7 | 5 | 12 | Opportunity, access |
| Streets and Infrastructure | 11 | 7 | 20 | Mobility, resilience |
| **Total** | **100** |  |  |  |

### 8.3 Outcome indices

Civic displays four illustrative indices from 0 to 100:

- Household Stability
- Access and Mobility
- Safety and Resilience
- Opportunity and Inclusion

Each district has visible weights for how program changes affect these indices. Scores are deterministic, versioned, and explicitly labeled **illustrative, not forecasts**.

The first implementation may use a transparent bounded formula:

`district outcome = clamp(0, 100, baseline outcome + sum(program delta x district weight x outcome coefficient))`

The Model Inspector must show the exact inputs and contribution of each program. No hidden model or generated coefficient is permitted.

### 8.4 Hard constraints

Every scenario must satisfy:

1. Total allocation equals exactly $100 million.
2. Every program remains within its minimum and maximum.
3. Emergency Response remains at or above $18 million.
4. Libraries and Digital Access remains at or above $5 million.
5. A user-pinned allocation cannot change unless the user removes the pin.
6. ~~No district's composite outcome may fall more than five points below its baseline.~~ **Demoted 08-29 to a surfaced warning, not a hard constraint.** A 3,000-scenario sweep over random priority weights and pin sets found this rule binds in 0.0% of cases at the five-point threshold, and still 0.0% at one point; it only reaches 9.8% at half a point. A composite that averages four indices, each touched by only one or two programs and then diluted across six districts, cannot move five points. As written the rule was inert: it added engine complexity and a failure path that could never fire or teach anything. The scenario rail instead displays each district's largest single-index decline, with a warning band above 1.5 points. If a hard version is wanted later, it must apply to the worst single index in a district, never the composite.
7. Every scenario uses the current model version and baseline version.

The constraint engine, not the agent, enforces these rules.

## 9. Core experience

### 9.1 Baseline orientation

On first load, the user sees:

- the $100M total budget;
- eight program allocations;
- animated flows from the total budget into programs;
- a six-district map showing baseline indices;
- a plain disclosure that all data and outcomes are fictional and illustrative;
- a short prompt suggestion for use with the browser agent.

### 9.2 Human-agent scenario loop

1. The user tells the browser agent a goal and constraints.
2. The agent calls `get_civic_state` and, when useful, `get_model_details`.
3. The agent calls `preview_scenario` with priorities and protected programs.
4. Civic's local constraint engine creates or rejects a feasible allocation.
5. A successful preview animates money flows and district changes.
6. The agent calls `focus_tradeoffs` to highlight the most important gains, losses, and binding constraints.
7. The user pins a program or rejects an unacceptable tradeoff in the page.
8. The agent calls `revise_scenario` using the changed live state.
9. The user compares the revision against baseline.
10. The user accepts or discards the scenario through a human-only control.
11. Civic creates an action receipt.

### 9.3 Signature demo request

Initial user prompt:

> Reduce housing instability and improve access to jobs without increasing the total budget. Do not cut emergency response.

The first preview should visibly move money into Housing Stability and Transit and Access. It should require reductions elsewhere.

The human then pins Climate and Parks after seeing a resilience loss, pins Youth and Learning and Libraries, and asks:

> Keep parks, youth and libraries exactly where they are. I need housing at 28 and transit at 22.

**This second request is deliberately infeasible, and the numbers are verified.** Three pins hold 29 of the 100. The two stated targets demand 50 more. Emergency Response cannot fall below 18, and Public Health and Streets cannot fall below their capped floors. The required total is 112.4 against a budget of 100, so the engine returns no plan and names five binding constraints: two target floors, three pins.

The agent then re-reads live state and recovers by dropping the hard targets and re-running on priority weights alone, which is always feasible. The recovery is visibly a *different kind* of request, not a retry of the same one.

This is where the demo's failure beat comes from, and it must be scripted rather than hoped for. Under the tool surface in Section 12 the agent cannot propose invalid arithmetic, and priority weights alone can never be infeasible, so the engine will never reject the agent spontaneously. The tension requires the human's pins to meet explicitly stated targets. This is prompt eval case 2 in Section 19.3.

The third preview should reallocate from different programs, animate the changed flows, and show the new district-level tradeoffs.

### 9.4 Signature visual moment

The strongest moment is not the first allocation. It is the revision:

- the user pins a value in the interface;
- the available WebMCP tools update;
- the agent discovers the changed live state;
- the previous flow retracts;
- new flows animate into place;
- one district improves while another tradeoff becomes visible;
- the receipt shows that the human constraint caused the revision.

This makes the human contribution visually indispensable.

## 10. Information architecture

The MVP is a single-page application with four coordinated regions.

### 10.1 Budget canvas

Primary visual area containing:

- total budget source;
- program nodes;
- animated funding flows;
- baseline and proposed values;
- pin controls;
- visual distinction between accepted, staged, and invalid state.

### 10.2 District map

Shows the six fictional districts and change in each outcome relative to baseline. The map must support:

- switching among four outcome indices;
- baseline versus staged comparison;
- keyboard-accessible district selection;
- non-color indicators for direction and magnitude;
- reduced-motion behavior.

### 10.3 Scenario rail

Shows:

- active request;
- binding constraints;
- largest gains and losses;
- staged scenario status;
- accept, revise, and discard controls;
- saved accepted scenarios for comparison.

### 10.4 Agent activity and receipt

Shows:

- discovered tool calls in sequence;
- whether each call read state or staged a mutation;
- validation result;
- model and baseline version;
- human decisions;
- replay control for the accepted scenario.

## 11. Visual and interaction requirements

The PRD defines information behavior, not a final visual style. Before implementation, exactly three visual directions must be generated and Ryan must select one.

All directions must preserve:

1. A dominant budget-flow visualization that reads at 1280x720 during the demo recording.
2. Clear visual separation among baseline, staged proposal, accepted scenario, and constraint violation.
3. Animated flow transitions that explain where dollars moved.
4. A district map that changes in synchronization with the budget.
5. A visible but secondary agent activity rail.
6. A strong before-and-after comparison state.
7. No reliance on color alone.
8. No decorative map, icon, or chart assets that imply real data.

Required interface states:

- first load;
- baseline selected;
- agent reading state;
- solver working;
- feasible preview;
- infeasible request;
- program pinned;
- revised preview;
- scenario accepted;
- scenario discarded;
- WebMCP unavailable;
- reduced motion;
- small viewport warning.

## 12. WebMCP tool surface

Tool names and outputs must remain compact. Read-only tools use `readOnlyHint`. Agent-visible descriptions and output should stay within current Chrome guidance.

### 12.1 Always registered

#### `get_civic_state`

Purpose: Return baseline version, model version, accepted scenario, staged scenario summary, pins, selected outcome, and current UI focus.

Mutation: None.  
Annotation: `readOnlyHint: true`.

#### `get_model_details`

Purpose: Return program bounds, hard constraints, outcome definitions, and disclaimer for requested programs or outcomes.

Mutation: None.  
Annotation: `readOnlyHint: true`.

#### `focus_tradeoffs`

Purpose: Focus and highlight specified programs, districts, outcomes, or constraints in the UI.

Mutation: Ephemeral visual state only. It must not alter the scenario.

### 12.2 Registered when no preview exists

#### `preview_scenario`

Purpose: Ask Civic's deterministic engine to generate a feasible allocation from structured priorities and protected programs.

Inputs:

- scenario name;
- priority weights for the four outcomes;
- protected program IDs — **the enum for this field is generated at registration time and lists only currently unpinned programs**;
- optional `targets`: explicit minimum or maximum dollar floors for named programs, used when the human states a firm requirement ("housing has to reach at least 28") rather than a direction of preference;
- optional maximum change per program, defaulting to 30% of baseline (see Section 14.4);
- short rationale.

`targets` is what makes infeasibility reachable at all, and it is required for challenge goal 4.2.3. Priority weights alone can never produce an infeasible request: any weight vector yields some feasible allocation inside the bounds, so a weights-only surface has no failure path. Verified against the fixtures: three pins with no targets is always feasible; the same three pins with `housing >= 28` and `transit >= 22` requires 112.4 against a 100 budget and fails with five nameable binding constraints.

A target is still not agent arithmetic. The agent supplies a floor the human stated in words; the engine decides every allocation and rejects the request outright if the floors cannot coexist. Section 14.2 is unchanged.

Because the enum is regenerated whenever pins change, a pinned program is not merely refused by the engine, it is absent from the schema the agent sees. The agent cannot express touching it. The live schema is rendered in the activity rail so this narrowing is visible.

Mutation: Creates a staged preview only.

The tool must never accept a free-form full allocation without validation. The local engine owns arithmetic and feasibility.

### 12.3 Registered when a preview exists

#### `revise_scenario`

Purpose: Re-run the staged scenario using current pins and revised priority weights.

Mutation: Replaces only the staged preview.

#### `compare_scenarios`

Purpose: Return and display the most important deltas between baseline, staged, and accepted scenarios.

Mutation: Ephemeral comparison state only.

#### `discard_preview`

Purpose: Remove the staged preview and restore baseline or the last accepted scenario.

Mutation: Removes unaccepted state. The action must be visible in the activity rail.

### 12.4 Registered on other page state

#### `unpin_program`

Registered when: at least one pin exists. Unregistered when the last pin is removed.

Purpose: Remove a pin the human previously set, at the human's spoken request.

Mutation: Clears a pin and triggers re-registration of `preview_scenario` with a widened `protectedPrograms` enum.

#### `test_assumption`

Registered when: a coefficient is selected in the Model Inspector. Unregistered on deselect.

Purpose: Suppress or override a single outcome coefficient **for preview only**, and recompute every affected district index so the human can see which parts of the staged case depend on that assumption.

Mutation: Ephemeral, non-canonical, and reversible, in the same category as `focus_tradeoffs`. Suppression is a mask over derived state, never a write to the model. The canonical coefficient is never altered, the mask auto-clears on scenario accept or discard, and no suppressed state can be carried into an accepted scenario or a receipt.

### 12.5 Human-only actions

No WebMCP tool may:

- accept a scenario;
- persistently change the model coefficients (`test_assumption` in Section 12.4 is preview-only, reversible, and never canonical);
- remove the fictional-data disclosure;
- export or publish a scenario;
- overwrite the baseline;
- bypass a pinned allocation.

Acceptance remains a direct, labeled UI control.

## 13. Functional requirements

### 13.1 P0: required for submission

- [ ] Load the Harbor City baseline with eight programs and six districts.
- [ ] Validate that all allocations total $100M and remain within bounds.
- [ ] Display synchronized budget-flow and district-map views.
- [ ] Let a user pin and unpin program allocations.
- [ ] Register and unregister WebMCP tools based on scenario state.
- [ ] Generate a feasible staged scenario from priority weights and pins.
- [ ] Explain infeasible requests using binding constraints.
- [ ] Animate the difference between baseline and staged scenarios.
- [ ] Let the user accept or discard a staged scenario.
- [ ] Compare baseline, staged, and accepted scenarios.
- [ ] Record a deterministic action receipt.
- [ ] Persist accepted scenarios and user preferences locally.
- [ ] Reset the application to the canonical demo state.
- [ ] Show a useful compatibility state when WebMCP is unavailable.
- [ ] Run without authentication, API keys, or a server-side database.
- [ ] **Reducer models suppression as a reversible mask over derived state, not as a mutation plus undo.** No counterfactual UI is required at P0, but the state shape must permit one. Outcomes are computed from unsuppressed inputs, so enabling the P1 counterfactual becomes a flag and a transition rather than a rewrite. Building this as mutate-and-restore forfeits the P1 item entirely.

### 13.2 P1: include only after P0 is stable

Listed in priority order. The counterfactual holds a reserved slot on 2026-09-01 and is the first P1 item attempted.

- [ ] **Counterfactual control** that temporarily suppresses one allocation change or coefficient and shows which parts of the staged case collapse. Reserved slot: 09-01.
- [ ] Replay the scenario as a sequence of tool calls and visual changes.
- [ ] Encode a read-only scenario in the URL for sharing.
- [ ] Export a receipt as JSON or Markdown.
- [ ] Add a guided first-run tour that can be dismissed immediately.

### 13.3 P2: post-challenge only if separately approved

- Real public datasets
- User-created city models
- Multi-year budgets
- Collaborative sessions
- Authentication and cloud persistence
- Public scenario galleries
- AI-generated policy narratives
- Real-world forecast or recommendation features

## 14. Constraint and outcome engine

### 14.1 Responsibilities

The local engine must:

- normalize requested priority weights;
- honor pins and protected programs;
- satisfy all hard constraints;
- preserve the exact total budget;
- return a stable result for identical inputs;
- identify binding constraints;
- return structured reasons when no feasible result exists;
- calculate district outcome deltas;
- provide a trace that the Model Inspector and receipt can render.

### 14.2 Solver boundary

The agent may express objectives but may not supply authoritative arithmetic. Every proposed allocation is treated as untrusted input until validated by the engine.

The implementation may use a bounded linear optimizer or a deterministic custom allocation algorithm. Dependency selection is part of the technical spike. The public interface must remain stable regardless of implementation.

### 14.4 Default change cap

A linear objective over box constraints always produces corner solutions: every program lands on its minimum or its maximum. Measured on the fixtures, an uncapped solve drove 7 of 8 programs onto a hard bound, zeroing out youth, health, climate and libraries simultaneously. That is correct optimization and unusable product behavior. It makes the agent look reckless and the plan look like a stunt.

Therefore `preview_scenario` applies a **default maximum change of 30% of baseline per program** unless the caller supplies a different cap. The same solve under a 30% cap leaves only 2 of 8 programs on a bound and produces a plan that reads like a budget rather than a bang-bang control signal.

The cap is a product decision, not a modeling claim, and the Model Inspector must show it as such. Programs held by the cap rather than by a statutory bound are labeled differently in the scenario rail.

### 14.3 Numerical invariants

- Sum of allocations equals exactly 100 at a resolution of 0.1 million ($100k). The engine represents every dollar value as integer tenths of a million and constructs the allocation directly on that grid.
- The engine asserts the exact total after allocation. A future adapter that accepts continuous allocations must quantize them with the largest-remainder method before they cross the engine boundary.
- No program violates minimum or maximum.
- Pinned programs remain unchanged.
- All outcome scores remain between 0 and 100.
- Replaying the same scenario yields the same allocations and scores.
- Invalid or stale scenario versions never update the canonical UI state.

## 15. Data model

Minimum entities:

- `CityModel`: version, total budget, districts, programs, outcomes, constraints, disclaimer.
- `Program`: ID, label, baseline, minimum, maximum, outcome coefficients, district weights.
- `Coefficient`: ID, program ID, outcome ID, value, unit, `confidence` (`low` | `medium` | `high`), `provenance` (`seeded` | `user` | `external`), and a short source note. Confidence and provenance are rendered in the Model Inspector beside every value.
- `District`: ID, label, geometry reference, baseline outcomes.
- `ScenarioIntent`: name, priorities, protected programs, maximum changes, rationale.
- `Scenario`: ID, model version, allocations, outcomes, bindings, trace, status.
- `Pin`: program ID, value, creator, timestamp.
- `ToolReceipt`: tool name, sanitized inputs, output summary, state version, timestamp.
- `DecisionReceipt`: request, accepted scenario, comparison, model version, human action, and `coefficientsRelied` — every coefficient the accepted scenario depends on, carrying its confidence tier and provenance. The artifact that authorizes the decision also discloses the weakest input it rests on.

All challenge data ships as reviewed static JSON or TypeScript fixtures.

## 16. Technical architecture

### 16.1 Proposed stack

- React and TypeScript client application
- Static deployment on Vercel or equivalent
- Deterministic state reducer with versioned actions
- Browser-local persistence
- SVG or Canvas budget-flow visualization
- Lightweight district-map geometry created specifically for fictional Harbor City
- Client-side constraint and outcome engine
- Imperative WebMCP registration through `document.modelContext.registerTool`
- Unit, property, integration, and browser-level tests

No OpenAI API call is required. The browser agent supplies reasoning; Civic supplies tools, state, validation, and visualization.

### 16.2 Modules

- `model`: canonical Harbor City fixtures and formulas
- `engine`: feasibility, optimization, outcomes, and trace
- `state`: versioned reducer, staging, pins, acceptance, persistence
- `webmcp`: tool registration, schemas, execution adapters, lifecycle
- `visualization`: flows, map, transitions, comparison, reduced motion
- `receipts`: tool activity, human decisions, replay, export
- `evals`: prompt cases and expected tool behavior

### 16.3 State integrity

Every tool execution receives the current state version. A tool call based on stale state must fail with a short recovery message instructing the agent to call `get_civic_state` again.

Staged scenarios remain separate from accepted scenarios. UI selectors must not confuse preview state with canonical state.

### 16.4 Browser and deployment requirements

- Work in ChatGPT's in-app browser, which the challenge identifies as supporting WebMCP.
- Work in the challenge-supported Chrome configuration for secondary testing.
- Use a secure deployed origin and required WebMCP permissions and isolation behavior.
- Do not expose tools to additional origins.
- Show a compatibility message without crashing when `document.modelContext` is unavailable.

## 17. Safety, integrity, and disclosure

1. Display “Fictional city. Illustrative model. Not a policy forecast.” on every scenario view.
2. Make the full model inspector available without an agent.
3. Never use real demographic categories, partisan labels, election data, or protected-class targeting.
4. Do not present outcome changes as evidence of causation.
5. Do not let narrative text override engine output.
6. Sanitize all agent-provided names and rationale before rendering.
7. Keep tool descriptions and outputs concise.
8. Mark read-only tools accurately.
9. If external or user-generated content is added later, apply `untrustedContentHint` and a separate security review.
10. Log every agent mutation as staged, accepted, or discarded.

## 18. Accessibility and usability

- Full keyboard path for selecting programs, districts, outcomes, pins, and scenario actions.
- Visible focus states.
- Program and district changes conveyed by text, direction, and magnitude, not color alone.
- Reduced-motion mode that replaces animated flow with immediate transitions and a change list.
- Screen-reader summaries of the baseline and staged scenario.
- Minimum text contrast meeting WCAG AA.
- No map interaction required to understand the scenario.
- Plain-language constraint errors with links to the affected programs.
- Target the desktop in-app browser first; show a clear small-screen adaptation or notice rather than a broken canvas.

## 19. Testing and evaluation

### 19.1 Unit and property tests

- Program bounds
- Exact budget total
- Pin preservation
- Deterministic replay
- Outcome clamping
- Constraint conflict reporting
- State-version rejection
- Staged versus accepted separation

Property tests should generate varied priorities and pins, then assert every numerical invariant.

### 19.2 WebMCP integration tests

- Tools register on page load.
- Tool set changes when preview state changes.
- Read-only calls do not mutate state.
- Preview and revision calls affect staged state only.
- Stale calls recover through `get_civic_state`.
- Invalid program IDs return concise errors.
- Repeated tool calls do not create duplicate state.

### 19.3 Prompt eval set

Run each core prompt at least five times from a fresh browser session:

1. Feasible goal with one protected program.
2. Infeasible goal with conflicting pins **and explicit targets**. Weights plus pins alone will not fail; the case must state firm dollar targets. Expected behavior: no plan, five named binding constraints, then agent-initiated recovery by dropping the targets.
3. Ambiguous request requiring the agent to inspect model details.
4. Revision after the human changes a pin in the UI.
5. Comparison of baseline and staged scenario.
6. Request for a real-world recommendation, which the product must decline or reframe as an illustrative scenario.

Success requires the correct tool sequence and a coherent page state, not identical prose.

### 19.4 Visual QA

Verify all required states at:

- 1440x900
- 1280x720
- reduced motion
- keyboard-only navigation

The final demo viewport must keep budget flow, map changes, and the agent activity rail legible simultaneously.

## 20. Success metrics and acceptance criteria

The challenge MVP is ready only when:

- [ ] A fresh user can identify the largest three baseline programs in under 30 seconds.
- [ ] ChatGPT discovers the expected tools from a fresh in-app browser session.
- [ ] The signature prompt produces a feasible staged scenario in five out of five runs.
- [ ] Pinning Climate and Parks causes a visibly different revision in five out of five runs.
- [ ] Every generated scenario satisfies all numerical invariants.
- [ ] A user can identify at least one gain and one loss without reading agent prose.
- [ ] No agent tool can accept a scenario.
- [ ] The activity rail and receipt accurately distinguish read, staged, discarded, and human-accepted actions.
- [ ] The solver returns in under 500 ms for the Harbor City model on the demo machine.
- [ ] A normal visual state updates within 200 ms after a completed engine result.
- [ ] The core recorded walkthrough fits within 150 seconds.
- [ ] The deployed app has no uncaught console errors during the demo flow.
- [ ] The public repository contains all required source, assets, instructions, and a visible MIT license.

## 21. Challenge deliverables

Required submission package:

- Working live URL accessible to judges
- Public Git repository
- Open-source license visible in the repository
- Reproducible local setup instructions
- Text description explaining WebMCP fit, user experience, human-agent collaboration, and implementation
- Public YouTube demo under three minutes with audio
- Testing instructions for ChatGPT's in-app browser and supported Chrome configuration
- Screenshots showing baseline, first proposal, human pin, revision, and accepted comparison

Primary references, verified 2026-08-29:

- [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/)
- [Official Devpost rules](https://webmcp.devpost.com/rules)
- [Challenge resources](https://webmcp.devpost.com/resources)
- [WebMCP specification and explainer](https://github.com/webmachinelearning/webmcp)
- [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [Chrome WebMCP evaluation guidance](https://developer.chrome.com/docs/ai/webmcp/evals)

## 22. Delivery plan

### 2026-08-29: product definition

- Finalize this PRD.
- Generate exactly three visual directions.
- Select one visual target before implementation.
- Spike the constraint engine interface and WebMCP registration.

Gate: a deployed minimal page exposes `get_civic_state` and `preview_scenario`, and one agent call visibly stages a valid scenario.

### 2026-08-30: deterministic core

- Implement canonical model, constraints, outcomes, and tests.
- Implement baseline, staged, accepted, pin, and reset state.
- Build the selected budget-flow and district-map composition.
- **Run the constraint 6 feasibility sweep.** Once fixtures exist, sweep the priority-weight and pin space and measure what share of reasonable requests the district-decline rule makes infeasible. If the rate is high, demote constraint 6 from a hard constraint to a surfaced warning in the scenario rail before any demo scripting depends on it.

Gate: manual UI can complete baseline, proposal, pin, revision, accept, and reset without WebMCP.

### 2026-08-31: WebMCP collaboration

- Implement the full P0 tool surface and dynamic lifecycle.
- Add activity rail, stale-state handling, constraint conflicts, and receipts.
- Verify the signature flow twice from fresh ChatGPT browser sessions.

Gate: the complete human-agent loop works without developer intervention.

### 2026-09-01: polish and hardening

- Complete accessibility states, reduced motion, responsive behavior, and visual transitions.
- Run unit, property, integration, and prompt evaluations.
- Deploy a stable public candidate.

Gate: all MVP acceptance criteria except submission assets pass.

### 2026-09-02: submission package

- Freeze scope.
- Record and edit the 150-second demo.
- Publish the repository and license.
- Draft Devpost text, screenshots, and testing instructions.

Gate: another person can follow the testing instructions and reproduce the signature flow.

### 2026-09-03: buffer and submit

- Fix submission blockers only.
- Submit by 12:00 p.m. ET, four hours before the official deadline.
- Capture the live URL, repository, video, and Devpost confirmation.

## 23. Stop rules

- If the minimal WebMCP tool call cannot stage a visible scenario by the end of 2026-08-29, stop and diagnose before building more UI.
- If the deterministic engine and complete manual loop are not stable by the end of 2026-08-30, reduce the model to four programs and three districts.
- If ChatGPT cannot repeat the full tool flow twice by the end of 2026-08-31, stop feature work and simplify the tool surface.
- Do not add P1 work while any P0 acceptance criterion is failing.
- Do not connect real government data for the challenge.
- Do not continue product development after submission until the 2026-09-05 review.

## 24. Open decisions

These decisions must be resolved before their dependent work begins:

1. Select one of exactly three visual directions before UI implementation.
2. Choose the bounded constraint-engine implementation during the technical spike.
3. Select Vercel or another static host before the first deployed WebMCP test.
4. ~~Confirm final fictional district geometry after visual direction selection.~~ **Closed 08-29: six abstract tiles in a 3x2 grid, not irregular polygons.** Tiles satisfy Sections 10.2 and 18 (keyboard selection, non-color direction and magnitude indicators, legibility at 1280x720) at a fraction of the cost, and irregular boundaries buy only still-frame appeal. All three visual directions inherit this.
6. Decide whether one or two programs are labeled **not modeled** in the Model Inspector rather than mapped to an outcome index. Doing so is honest, since no index captures what a library is worth, and it makes pinning a values act rather than an optimization the agent could have performed itself. Blocks fixture authoring only.
5. Confirm the public repository name and MIT license before submission packaging.

No open decision blocks the initial visual exploration or engine/WebMCP spike.
