# Civic — PRD / Spec Alignment Report

Date: 2026-08-29
Reconciles: `PRD.md` (v0.1) against the externally drafted design spec (`civic-tradeoff-lab-spec.md`)

---

## 0. Verdict

**Keep them separate. The PRD is canonical.**

The spec was written without sight of the PRD and independently invented a parallel world (different city, different programs, different constraints, different tool names). The PRD is the more rigorous document on nearly every axis: it has a real persona, a stop-rule discipline, an eval suite, accessibility requirements, numerical invariants, and a tighter delivery plan. Almost nothing in the spec's model layer should survive contact with it.

Correct division of labor going forward:

| Document | Owns |
|---|---|
| `PRD.md` | Product argument, personas, principles, scope boundaries, tool contract, acceptance criteria, delivery plan, stop rules |
| `SPEC.md` (rewritten from the draft) | Implementation detail subordinate to the PRD: concrete fixture values, coefficient tables, solver algorithm, rounding strategy, animation timings, storyboard |

The spec becomes an appendix, not a peer. Everything below is what has to change for that to be true.

---

## 1. Naming and model conflicts (spec yields entirely)

| Dimension | PRD (keep) | Spec (discard) |
|---|---|---|
| City | Harbor City | Calder City |
| Districts | North Harbor, East Junction, River Ward, Central, South Point, West Hills | Riverside, Northgate, Eastmoor, Foundry, Highland, Southbank |
| Programs | Housing Stability, Transit and Access, Emergency Response, Public Health, Youth and Learning, Climate and Parks, Libraries and Digital Access, Streets and Infrastructure | Roads, Transit, Flood, Library, Sanitation, Parks, Sidewalks, Lighting |
| Outcomes | 4 indices, 0–100, clamped | 3 mixed-unit outcomes |
| Constraints | 7 (PRD §8.4) | 5 (spec §4) |
| Tool names | `get_civic_state`, `get_model_details`, `focus_tradeoffs`, `preview_scenario`, `revise_scenario`, `compare_scenarios`, `discard_preview` | `get_budget_state`, `propose_reallocation`, `protect_allocation`, etc. |
| Registration API | `document.modelContext.registerTool` | unspecified |
| Signature moment | Pin-driven revision (PRD §9.4) | Counterfactual collapse |
| Demo length | 150 s | ~40 s of beats |
| License | MIT | unspecified |

**Action:** delete the spec's §2, §3, §4, §5, §7 wholesale. The Calder City fixtures, the five constraints, and the coefficient values are dead. Any downstream artifact still referencing Calder City, flood mitigation, sanitation, or constraint IDs C1–C5 is stale.

One recommendation the spec made is hereby withdrawn: it argued for a politically neutral, infrastructure-only program set. The PRD already solves that problem better. Emergency Response carries a hard floor of 18 against a baseline of 20 (so it can only move 2), the signature prompt explicitly protects it, §17.3 bars partisan and demographic framing, and every view carries a fiction disclosure. That is adequate. Keep the PRD's program set.

---

## 2. Substantive divergences requiring a decision

### D1. Input model — the deepest divergence

The PRD has the agent supply **priority weights plus protected programs**, and the deterministic engine solves for the allocation (§12.2, §14.2). The spec had the agent supply **explicit dollar deltas**, which the engine then validated or rejected.

**Recommendation: keep the PRD's design.** It is the stronger version of the product's own thesis. Under the PRD the agent cannot express arithmetic at all, which is a far better answer to "generative answers sound plausible without being feasible" (§2) than validating numbers after the fact.

But it has a cost the PRD has not fully absorbed. Under a weights-based solver, the engine always returns a feasible plan unless the *human's* pins conflict. That means challenge goal 4.2.3 ("at least one failed or infeasible proposal recovering cleanly") is satisfied by the human causing the failure, not the agent. The dramatic beat "the page refuses the agent" is weaker than it looks on paper.

Mitigation, no architecture change required: source the infeasibility from the combination the PRD already scoped in eval case 2 — user pins two programs, then states a goal that cannot be reached inside the remaining bounds. The engine returns binding constraints, the agent reads them and revises. The page still refereed the exchange; the human just supplied the tension. Script the demo this way rather than hoping the agent overreaches.

### D2. Counterfactual — P1 in the PRD, centerpiece in the spec

The PRD puts "temporarily remove one allocation change" at §13.2 P1. The spec built the entire demo around it.

**Recommendation: leave it in P1, but promote it to the first P1 item with a reserved slot on 09-01, and make a P0 design choice today that renders it nearly free.**

That design choice: implement suppression as a **reversible mask over derived state**, never as a mutation plus undo. Coefficients and allocation deltas carry a `suppressed` flag; all outcomes are computed from unsuppressed inputs. If the reducer is built that way from day one, the counterfactual is a flag plus a transition, roughly an hour. If it is built as mutate-and-restore, it is a day and it will not happen.

The PRD's sequencing discipline is right and the spec was wrong to make a P1 item the centerpiece with four days left. But the PRD understates the ceiling: staged-changes-plus-approval is the pattern most entries will land on, and the counterfactual is the rarer thing. Worth an hour of insurance in the reducer design.

### D3. Coefficient manipulation vs §12.4

PRD §12.4 states that no WebMCP tool may change the model coefficients. The spec's `test_assumption` tool does exactly that, so as written the two documents directly contradict.

**Recommendation: amend §12.4 to prohibit *persistent* coefficient changes, and permit an explicitly ephemeral one.** Add to §12.3, registered only when a coefficient is selected in the Model Inspector:

- `test_assumption` — suppresses or overrides one coefficient **for preview only**. Same category as `focus_tradeoffs`: ephemeral, non-canonical, auto-clearing, never written to the accepted scenario. Canonical coefficients remain immutable to every tool.

This preserves §12.4's intent (the agent can never silently alter the model that authorizes a decision) while allowing the agent to help the human interrogate an assumption, which is squarely on-thesis for §7.5.

If you would rather not touch §12.4 at all, the fallback is to make the counterfactual a human-only UI control and let the agent merely narrate it. That is safe and slightly less impressive.

---

## 3. Additive items from the spec worth folding into the PRD

These do not conflict with anything. Each is cheap and each strengthens a stated PRD goal.

**A1. Coefficient confidence tiers and provenance.** Extend the `Program` entity (§15) so every coefficient carries `confidence: "low" | "medium" | "high"` and `provenance: "seeded" | "user" | "external"`. Render both in the Model Inspector. Directly serves §7.5 and §17.4 at almost no cost.

**A2. The receipt discloses its weakest input.** Add to `DecisionReceipt` (§15) a `coefficientsRelied` array listing every coefficient the accepted scenario depends on, with its confidence tier. The artifact that authorizes the decision also discloses the shakiest thing it rests on. This is the single most credible anti-theatre move available and it costs a few lines.

**A3. Pin-driven schema narrowing.** §12 already promises that tool availability changes with scenario state. Go one step further and narrow the *schema*, not just the tool set: `preview_scenario`'s `protectedPrograms` enum lists only unpinned programs, and `unpin_program` registers only when at least one pin exists. Show the live schema in the activity rail so a viewer watches the enum shrink when a pin lands. A boundary enforced by the type system reads far better to a judge than one enforced by a description string, and it is a strong answer to the WebMCP Leverage criterion.

**A4. Explicitly unmodeled programs.** The PRD currently maps all eight programs to outcomes. Consider labeling one or two as **not modeled** in the Model Inspector. It is honest (no index captures what a library is worth), and it makes pinning a values act rather than an optimization the agent could have performed itself. This is what makes Maya indispensable rather than slow.

**A5. Abstract district geometry.** Open decision §24.4 asks for final fictional district geometry. Recommend closing it as a six-tile abstract grid rather than irregular polygons. It satisfies §10.2 and §18 (keyboard selection, non-color indicators, legibility at 1280×720) at a fraction of the cost, and irregular boundaries buy nothing but still-frame appeal you do not have time for.

---

## 4. Two implementation traps in the PRD as written

**T1. Integer-million rounding will break the exact-total invariant.** §14.3 requires the sum to equal 100 in exact integer-million units, while §12.2 has the solver produce allocations from continuous priority weights. Rounding eight fractional values independently to integers will not reliably sum to 100.

Two fixes, pick one: adopt 0.1M ($100k) precision, which displays cleanly and gives the solver room; or keep integers and round with a largest-remainder method that forces the sum. Recommend 0.1M. Note that this invalidates the spec's illustrative numbers either way, which is fine since those fixtures are being discarded.

**T2. Constraint 6 may over-constrain the solver.** "No district's composite outcome may fall more than five points below its baseline" applies across six districts and four indices. That is a large binding surface, and combined with two user pins it could make a large share of reasonable requests infeasible, which would turn the signature demo into a constant stream of rejections.

This cannot be checked without the district weight and coefficient values, which the PRD does not yet specify. Make it a day-one spike: once fixtures exist, sweep the pin and weight space and measure the infeasibility rate. If it is high, demote constraint 6 from a hard constraint to a surfaced warning in the scenario rail.

---

## 5. Edits to make

**To `PRD.md`:**

1. §12.4 — amend to prohibit *persistent* coefficient change; add ephemeral `test_assumption` to §12.3.
2. §13.2 — mark the counterfactual as the first P1 item with a reserved 09-01 slot; add a P0 note that the reducer must model suppression as a mask over derived state.
3. §14.3 — resolve the precision question (recommend 0.1M) and specify the rounding method.
4. §15 — add `confidence` and `provenance` to coefficients; add `coefficientsRelied` to `DecisionReceipt`.
5. §12.2 — specify that `protectedPrograms` enumerates unpinned programs only; add `unpin_program` to §12.3.
6. §24.4 — close as a six-tile abstract grid.
7. §22 (08-30 block) — add the constraint-6 feasibility sweep.
8. §9.3 — rewrite the signature prompt sequence so the infeasible moment comes from pins plus goal, per D1.

**To the spec:** delete §2–§5 and §7 entirely, retitle as `SPEC.md`, and rebuild it as an implementation appendix carrying only fixture values in Harbor City terms, the solver algorithm and rounding method, the suppression-mask reducer design, animation timings, and the storyboard rewritten against the PRD's programs.

---

## 6. Schedule risk, stated plainly

The PRD's 08-29 gate is a deployed page exposing `get_civic_state` and `preview_scenario` with one agent call visibly staging a valid scenario, plus three visual directions generated and one selected. That is today, and the day is largely gone.

Stop rule §23.1 fires on that gate. Do not let it pass silently. If the WebMCP spike has not round-tripped by end of day, the honest move is to spend tomorrow morning on the spike alone and defer the visual direction selection, rather than building UI on an unverified foundation.

The single highest-value thing that can happen tonight is a trivial page registering one tool and having ChatGPT's in-app browser actually call it. Nothing else on the plan is worth an hour until that works.
