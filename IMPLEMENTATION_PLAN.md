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

### 3. WebMCP boundary — adapter complete; live round trip pending deploy

- Register always-available read and focus tools.
- Swap `preview_scenario` for revise/compare/discard tools based on preview state.
- Narrow `protectedPrograms` whenever pins change.
- Register `unpin_program` and `test_assumption` only in their valid states.
- Use one abort controller per registration generation so lifecycle changes do not leave duplicate tools.

Local gate passed: contract tests prove the exact tool set and schemas for baseline, staged, pinned, and coefficient-selected states. The browser gate still requires a secure deployed origin and ChatGPT in-app test.

### 4. Instrument interface

- Build the 1280x720 composition without editor zoom.
- Render synchronized budget flows, program rows, district tiles, scenario rail, activity, inspector, and receipt.
- Keep the local harness behind a developer/demo affordance.

Gate: the complete manual signature flow works without WebMCP.

### 5. Accessibility and browser verification

- Provide semantic controls, keyboard navigation, visible focus, screen-reader summaries, and 44px interaction targets.
- Honor `prefers-reduced-motion` and show a textual change list.
- Verify 1280x720 and 1440x900.
- Run the flow in ChatGPT's in-app browser and sponsor-aligned Chrome testing.

Gate: the complete WebMCP flow succeeds twice from fresh sessions without console errors.

### 6. Submission package

- Deploy the approved candidate.
- Capture baseline, proposal, pins, infeasibility, recovery, and receipt screenshots.
- Record the 150-second walkthrough.
- Publish the repository and submission materials only after explicit approval.
