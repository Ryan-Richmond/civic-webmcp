# Civic design fit audit

Date: 2026-08-29

## Verdict

Direction A, Instrument, is the better product fit and should be the visual basis for the shipping app. It makes the project thesis visible: a user can see the baseline, proposed value, delta, bound, pin, district effect, and constraint explanation without relying on agent prose.

Direction B, Situation room, has a stronger opening image but weakens the core comparison task. Its eight narrow columns separate labels from values, make program details small, and demote district outcomes. Keep its canonical-outline-versus-staged-bar encoding and full-width activity treatment, but do not use its overall composition as the primary direction.

Both are reference implementations, not submission-ready application code.

## Direction comparison

| Requirement | A: Instrument | B: Situation room |
|---|---|---|
| Baseline understood quickly | Strong | Medium |
| Baseline versus staged comparison | Strong | Medium-low |
| Pin and infeasibility beat | Strong | Medium |
| District outcomes remain prominent | Strong | Medium-low |
| Visually dramatic opening | Medium | Strong |
| Receipt and evidence readability | Strong | Medium |
| Actual 1280x720 fit | Fails currently | Fails currently |
| Accessibility path | Incomplete | Incomplete |
| Submission architecture | Not suitable | Not suitable |

## What the live walkthrough confirmed

1. Baseline: eight allocations, six districts, disclosures, model inspector, and compatibility state render together.
2. First proposal: Housing moves from 15.0 to 19.5 and Transit from 14.0 to 18.2; gains, losses, cap-held values, and district changes are visible.
3. Human pins: Climate, Youth, and Libraries disappear from the agent-facing protected-program choices and `unpin_program` appears.
4. Infeasible request: the engine returns no plan, reports $112.4M required against $100.0M, and names two targets plus three pins.
5. Recovery: dropping the hard targets produces a different feasible allocation while preserving all three pins.
6. Acceptance: only the in-page control accepts the scenario, and the receipt lists moved programs, pins, outcomes, model version, and coefficients relied upon.

## Corrections to the Claude review

- The math and signature storyboard are substantially correct, but the component is not spec-exact as a product contract.
- Tool schemas do not receive or validate `stateVersion`, so stale calls are not rejected as required by PRD section 16.3.
- The activity rail visibly logs a newly pinned program as `unpinned`. This is not only a future React batching risk; it is wrong in the current runtime.
- The preview labels a `protectedPrograms` enum, while the actual tool property is named `protect`.
- The UI says largest-remainder rounding occurred, but the solver constructs integer tenths directly and contains no largest-remainder pass. Keep the exact-tenths approach, but make the receipt and inspector truthful.
- `get_model_details` reports seven hard constraints while its returned list contains six after the district-decline rule was demoted to a warning.
- The receipt labels a counter containing human log entries as `tool calls`, so the count is not semantically accurate.
- Both layouts use a 1380px minimum width and were authored for a 1500x1040 preview. The Claude editor is showing them at 75% zoom. That masks the fact that the required 1280x720 viewport cannot show the budget, district outcomes, and activity rail together at normal scale.

## P0 gaps

- No browser-local persistence for accepted scenarios or preferences.
- No stale-state guard on mutating tools.
- No keyboard path for program labels, district tiles, or inspector rows; they are clickable `div` elements.
- Pin controls are 26x26 glyph-only buttons with no program-specific accessible name.
- No screen-reader baseline or staged summaries.
- Reduced motion is a Claude prop, not `prefers-reduced-motion`, and it does not provide the required change list.
- No React/TypeScript/Vite application, reducer modules, tests, README, license, or Git repository exists yet.
- The live shared design reports `WebMCP unavailable`; no deployed-origin ChatGPT round trip was proven in this audit.
- The PRD requires exactly three directions before selection; only two exist.

## Recommendation

1. Run the deployed-origin WebMCP spike before further UI work.
2. Produce the required third direction as a comparison-first layout: paired baseline/staged rows as the primary object, a slim money-transfer spine, district deltas beside the affected programs, and a compact scenario/activity rail.
3. Select A, then port only its information architecture and visual language into React and TypeScript.
4. Carry over two ideas from B: dashed canonical outlines versus solid staged bars, and a wider activity rail during the pin/tool-lifecycle beat.
5. Keep the local harness behind an explicit demo/developer mode so the product still reads as a shared visual workspace rather than an embedded chatbot.
6. Port fixtures and engine first, adding property tests, state-version rejection, truthful receipts, persistence, and accessibility before visual polish.

## Captured evidence

- `01-instrument-baseline.png`
- `02-situation-room-baseline.png`
- `03-instrument-first-proposal.png`
- `04-instrument-three-pins.png`
- `05-instrument-infeasible.png`
- `06-instrument-recovered.png`
- `07-instrument-accepted-receipt.png`

Evidence limit: visual contrast, keyboard behavior, assistive-technology output, motion preferences, and true 1280x720 behavior still require testing in the ported application. The Claude Design share is a reference surface, not the deployable architecture.
