# Civic Instrument design QA

## Evidence

- Source visual truth: `audit/source-instrument-baseline-crop.png`, cropped from the selected Instrument state in `audit/01-instrument-baseline.png`.
- Browser-rendered implementation: `audit/implementation-baseline-1280x720.png`.
- Full-view comparison: `audit/design-qa-baseline-comparison.png`.
- Focused budget comparison: `audit/design-qa-budget-focused-comparison.png`.
- Additional rendered states: `audit/implementation-proposal-1280x720.png`, `audit/implementation-pinned-1280x720.png`, `audit/implementation-infeasible-1280x720.png`, `audit/implementation-recovered-1280x720.png`, and `audit/implementation-receipt-1280x720.png`.
- Implementation viewport: 1280 × 720 CSS px at device pixel ratio 1; screenshot is 1280 × 720 px.
- Source crop: 1145 × 970 px from a 1473 × 1083 editor capture. It preserves the selected design's native composition; it is displayed proportionally beside the target implementation rather than stretched to the wider 16:9 acceptance viewport.
- Focus crops: source budget 808 × 382 px; implementation budget 934 × 370 px. Both preserve native density and are displayed proportionally.
- State: baseline for the primary comparison. Proposal, pinned, infeasible, recovered, accepted, and receipt states were separately exercised in the same browser session.

## Findings

No visual P0, P1, or P2 differences remain in the locally verified fallback states. Deployed WebMCP integration is tracked separately below.

- Fonts and typography: self-hosted Source Serif 4, Inter, and IBM Plex Mono preserve the source hierarchy and technical-instrument character. Dense labels remain legible at the required viewport.
- Spacing and layout rhythm: the same header, budget canvas, district grid, scenario rail, harness, activity rail, and inspector hierarchy is preserved. The implementation intentionally compresses the source's tall editor preview into the PRD's 1280 × 720 target without hiding persistent controls.
- Colors and visual tokens: paper, ink, neutral, teal, rust, rule, and panel colors match the selected light Instrument direction. Every change also has a number and direction marker.
- Image and asset fidelity: the selected design contains no photographic or illustrative raster assets. The Sankey is rendered by Recharts and pin/status icons come from Phosphor rather than handcrafted glyphs.
- Copy and content: fictional-city, model, exact-total, human-only acceptance, tool-surface, constraint, and disclosure language is preserved. The approved Libraries decision is more explicit than the source: it is visibly labeled not modeled.

## Comparison history

1. Initial pass: Sankey links rendered as thin paths because fill styling was applied to a stroke-based chart primitive. Fixed by applying the neutral token to variable-width link strokes. Post-fix evidence: `audit/design-qa-budget-focused-comparison.png`.
2. Interaction-state pass: the 124 px scenario rail clipped controls in the five-conflict state. Fixed by reallocating 10 px from the district region, compacting conflict badges, and keeping all controls visible. Post-fix evidence: `audit/implementation-infeasible-1280x720.png`.
3. Baseline pass: the inspector initially opened to Housing Stability while the source opened to the whole model. Fixed by restoring the whole-model baseline view and moving program detail behind row selection. Post-fix evidence: `audit/design-qa-baseline-comparison.png`.

## Browser verification

- Primary interactions tested: reset; first proposal; three human pins; firm-target infeasibility; target-free recovery; human acceptance; decision receipt; Libraries selection.
- A local runtime integration test injects the browser contract, verifies all four baseline tools register, and
  confirms that the fallback harness disappears when WebMCP is live. Contract tests verify post-mutation versions,
  dynamic tool swapping, schema narrowing, and stable-core registration.
- Contract tests prove the pinned schema removes `youth`, `climate`, and `libraries` from `protectedPrograms` and
  registers `unpin_program` for those IDs. A fresh in-app browser run against the exact PR production build observed
  those changes, completed infeasibility and recovery, accepted through the human control, and retained WebMCP live.
- Console warnings and errors checked after the complete flow: none.

## Follow-up polish

- P3: the selected source retains an inactive Situation Room direction switch. The implementation intentionally removes it because Instrument is now the product direction.
- P3: the source includes a fourth counterfactual harness shortcut. The conditional `test_assumption` WebMCP tool exists, but the dedicated P1 harness shortcut remains deferred.

## Implementation checklist

- [x] Preserve Instrument composition and palette.
- [x] Fit the entire P0 workspace at 1280 × 720.
- [x] Keep all signature-flow controls functional.
- [x] Show Libraries as not modeled.
- [x] Verify dynamic WebMCP registration in the in-app browser against the PR production build.
- [x] Check the console after the complete flow.


## Accessibility verification — 2026-08-29

Measured in the browser against PRD section 18, at 1280x720 and 1440x900, device pixel ratio 1.

| Requirement | Result |
|---|---|
| Full keyboard path for programs, districts, outcomes, pins, and scenario actions | Pass. 35 focusables, all native `<button>`, zero non-button click handlers. Tab order follows the reading order; district tiles are now real controls rather than inert cards. |
| Visible focus states | Pass. A teal focus ring on every control; panels no longer clip it. |
| Change conveyed by text, direction, and magnitude, not colour alone | Pass. Every delta carries a sign, every district movement an arrow and a number, every change chip a direction glyph. |
| Reduced motion with a change list | Pass. `prefers-reduced-motion: reduce` skips the transition entirely and swaps to the new allocation, and the change list is present in every staged state rather than only under the media query. |
| Screen-reader summaries of baseline and staged scenario | Pass. A static baseline summary in the budget canvas, a per-district summary on each tile, and a `role="status"` region that announces each new state version. |
| Text contrast meeting WCAG AA | Pass. Two failures fixed: body muted text on the alternate background, 4.03, and the harness caption, 3.65. Now 4.94 and 5.25 at worst. |
| No map interaction required | Pass. District selection is optional and stated as optional in the panel. |
| Plain-language constraint errors linking to affected programs | Pass. Each binding constraint is a button that selects and scrolls to its program row. |
| Small-screen adaptation or notice | Pass. Below 1050px the workspace stacks and a notice appears; below 700px the flow diagram gives way to the program list, which carries the same numbers. Neither axis overflows at 380px. |

### Deliberate deviations

- **Target size.** Every control meets WCAG 2.2 AA Target Size (Minimum), 24x24 CSS px, and the repeated controls
  exceed it: pin buttons fill a 34x37 cell, program labels fill the full 37px row, district tiles are 56px tall.
  26 controls remain under 44px in one dimension. 44px is AAA / platform-HIG guidance and cannot coexist with a
  single-screen 1280x720 workspace holding eight program rows, four index tabs, and a scenario action row.
  Escalated in `IMPLEMENTATION_PLAN.md` rather than silently adopted.
- ~~**Animated flow transitions.**~~ Closed. Implemented to the SPEC.md section 4 parameters: 500ms ease-out,
  staggered 40ms per program in descending magnitude. See the motion note below.

### Evidence limits

- Keyboard *reachability*, tab order, and focus visibility were verified by driving real Tab presses in the browser.
  Keyboard *activation* was verified structurally and by pointer: the automation channel's injected key events do
  not carry the native activation that produces a click on a focused button, so Enter and Space could not be
  exercised end to end here. Every control is a native button with an `onClick`, which the platform activates.
- No assistive technology was driven directly. The summaries were read out of the DOM, not heard.
- Contrast was computed from the token values rather than sampled from rendered pixels.

## Correctness defects found during this pass

The full signature flow was re-run in the browser, which surfaced a defect that the visual QA could not:

1. **A preview solved before a pin could still be accepted.** Pinning Youth, Climate, and Libraries after the first
   proposal was staged left an acceptable scenario that moved all three, and the resulting receipt claimed the pins
   were held at values the allocation contradicted. Acceptance is now blocked in the reducer and the UI until the
   agent revises against the pins; the rail and the announcer say so.
2. **The receipt was not auditable.** It now lists every program that moved with its before and after value, the
   exact total, the pins held, and the coefficients relied upon, and it states that no suppressed assumption can
   enter a receipt.
3. **The activity rail overstated agent work** by counting human decisions as tool calls and by opening with a
   `get_civic_state` entry that no agent had made. Both are corrected.
4. **Screen-reader text widened the page.** The visually hidden spans had no positioned ancestor, escaped their
   clipping containers, and pushed the document 74px wider than the viewport. Their hosts are now positioned.

## Motion — 2026-08-29

`SPEC.md` section 4 specifies 500ms ease-out with a 40ms stagger in descending magnitude, so the eye follows the
largest transfer first. That is what is implemented.

The motion is driven from the data, not from CSS on the rendered elements. Recharts remounts its Sankey link
paths on every data change — verified in the browser: the path element that held the old geometry is no longer
in the document after a restage — so a CSS transition on those paths can never fire. Instead `useAnimatedAllocation`
eases the allocation itself and the flow diagram, the program bars, and the district tiles all render from that one
clock, which also satisfies the PRD section 11.4 requirement that the map change in synchronization with the budget.

Displayed numerals, deltas, direction markers, and every screen-reader summary read from the settled allocation,
never from the in-flight one, so no number is ever readable in a state the model was not actually in.

If the page is hidden the transition is skipped and the new allocation is applied immediately. This matters here
rather than being a nicety: an agent can stage a scenario while the in-app browser is backgrounded, where
`requestAnimationFrame` never runs, and without the guard the flow diagram would keep showing an allocation the
numbers had already left.

### Evidence limits for motion

The interpolation is covered by unit tests: stagger ordering by descending magnitude, programs that did not move
carry no delay, the curve is past its halfway point at half the duration, the transition lands exactly on the
target, and no frame overshoots either endpoint. The wiring was verified in the browser — bar width, Sankey
geometry, and district values all move together and settle on the correct values.

The motion was **not** watched frame by frame. The automation pane keeps the document hidden, which pauses
`requestAnimationFrame`, so intermediate frames cannot be sampled here. Confirming it looks right on screen is a
human check at `localhost:5173`.

final result: passed
