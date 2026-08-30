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

No actionable P0, P1, or P2 differences remain.

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
- A real in-app WebMCP call staged the first visible proposal, returned the post-mutation version, and dynamically swapped the registered tool surface.
- The pinned schema removed `youth`, `climate`, and `libraries` from `protectedPrograms` and registered `unpin_program` for those IDs.
- Console warnings and errors checked after the complete flow: none.

## Follow-up polish

- P3: the selected source retains an inactive Situation Room direction switch. The implementation intentionally removes it because Instrument is now the product direction.
- P3: the source includes a fourth counterfactual harness shortcut. The conditional `test_assumption` WebMCP tool exists, but the dedicated P1 harness shortcut remains deferred.

## Implementation checklist

- [x] Preserve Instrument composition and palette.
- [x] Fit the entire P0 workspace at 1280 × 720.
- [x] Keep all signature-flow controls functional.
- [x] Show Libraries as not modeled.
- [x] Verify dynamic WebMCP registration in the in-app browser.
- [x] Check the console after the complete flow.

final result: passed
