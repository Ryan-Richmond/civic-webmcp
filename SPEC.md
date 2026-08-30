# Civic — Implementation Spec

Subordinate to `PRD.md`. The PRD owns the product contract; this document owns fixture values, solver behavior, state shape, and the storyboard. Where the two disagree, the PRD wins and this file is wrong.

Every number below was verified programmatically on 2026-08-29. Verification results are in section 7.

---

## 1. Fixtures — Harbor City

### 1.1 Programs

Dollar values in millions. Baseline sums to exactly 100.

| id | label | baseline | min | max |
|---|---|---:|---:|---:|
| `housing` | Housing Stability | 15 | 8 | 30 |
| `transit` | Transit and Access | 14 | 8 | 25 |
| `emergency` | Emergency Response | 20 | 18 | 25 |
| `health` | Public Health | 11 | 7 | 20 |
| `youth` | Youth and Learning | 14 | 8 | 22 |
| `climate` | Climate and Parks | 8 | 4 | 16 |
| `libraries` | Libraries and Digital Access | 7 | 5 | 12 |
| `streets` | Streets and Infrastructure | 11 | 7 | 20 |

### 1.2 Districts

Rendered as six abstract tiles in a 3x2 grid (PRD §24.4, closed).

`north_harbor` · `east_junction` · `river_ward` · `central` · `south_point` · `west_hills`

### 1.3 Outcome indices

`stability` (Household Stability) · `mobility` (Access and Mobility) · `safety` (Safety and Resilience) · `opportunity` (Opportunity and Inclusion). All 0–100, clamped.

### 1.4 Baseline district outcomes

| district | stability | mobility | safety | opportunity |
|---|---:|---:|---:|---:|
| north_harbor | 62 | 55 | 68 | 58 |
| east_junction | 54 | 74 | 61 | 63 |
| river_ward | 41 | 58 | 52 | 44 |
| central | 59 | 78 | 66 | 69 |
| south_point | 57 | 62 | 63 | 59 |
| west_hills | 74 | 44 | 77 | 71 |

River Ward is the deliberate low-outcome district and is where the signature scenario's gains land.

### 1.5 District incidence weights

Each program's spending distributes across districts. Every row sums to exactly 1.0 (verified).

```json
{
  "housing":   {"river_ward":0.30,"south_point":0.22,"east_junction":0.18,"north_harbor":0.14,"central":0.11,"west_hills":0.05},
  "transit":   {"east_junction":0.28,"central":0.24,"south_point":0.20,"north_harbor":0.13,"river_ward":0.11,"west_hills":0.04},
  "emergency": {"central":0.22,"south_point":0.20,"river_ward":0.19,"east_junction":0.17,"north_harbor":0.13,"west_hills":0.09},
  "health":    {"river_ward":0.27,"south_point":0.21,"east_junction":0.18,"central":0.16,"north_harbor":0.12,"west_hills":0.06},
  "youth":     {"south_point":0.25,"river_ward":0.24,"east_junction":0.19,"north_harbor":0.15,"central":0.10,"west_hills":0.07},
  "climate":   {"north_harbor":0.24,"west_hills":0.21,"south_point":0.19,"river_ward":0.16,"central":0.12,"east_junction":0.08},
  "libraries": {"central":0.23,"east_junction":0.20,"south_point":0.19,"river_ward":0.18,"north_harbor":0.13,"west_hills":0.07},
  "streets":   {"west_hills":0.21,"south_point":0.20,"north_harbor":0.19,"east_junction":0.16,"river_ward":0.13,"central":0.11}
}
```

### 1.6 Outcome coefficients

Units: index points per $1M of **district-attributed** spend. Every coefficient carries confidence and provenance per PRD §15 and both render in the Model Inspector.

| id | program | outcome | value | confidence | provenance |
|---|---|---|---:|---|---|
| `cf_housing_stability` | housing | stability | 1.6 | low | assumed |
| `cf_housing_opportunity` | housing | opportunity | 0.5 | low | assumed |
| `cf_transit_mobility` | transit | mobility | 1.4 | medium | seeded |
| `cf_transit_opportunity` | transit | opportunity | 0.4 | low | assumed |
| `cf_emergency_safety` | emergency | safety | 1.5 | medium | seeded |
| `cf_health_stability` | health | stability | 0.7 | low | assumed |
| `cf_health_safety` | health | safety | 0.6 | low | assumed |
| `cf_youth_opportunity` | youth | opportunity | 1.5 | low | assumed |
| `cf_climate_safety` | climate | safety | 0.9 | low | assumed |
| `cf_libraries_opportunity` | libraries | opportunity | 1.1 | low | assumed |
| `cf_libraries_mobility` | libraries | mobility | 0.3 | low | assumed |
| `cf_streets_mobility` | streets | mobility | 1.0 | medium | seeded |
| `cf_streets_safety` | streets | safety | 0.5 | low | assumed |

`cf_housing_stability` is the counterfactual target for the P1 beat: it is the largest coefficient in the model, it is marked low-confidence and assumed, and it is the sole justification for the signature scenario's headline gain. Suppressing it collapses the case while leaving the cuts in place.

### 1.7 Outcome formula

```
district_outcome[d][o] = clamp(0, 100,
    baseline[d][o] + Σ_p ( (alloc[p] − baseline[p]) × incidence[p][d] × coeff[p][o] )
)
```

Linear, deterministic, fully inspectable. The Model Inspector renders each program's contribution term separately so a user can read the arithmetic without an agent.

---

## 2. Solver

### 2.1 Contract

Input: normalized priority weights over the four outcomes, a set of pinned programs, optional `targets` (firm dollar floors or ceilings for named programs), optional change cap.

Output: either a feasible allocation summing to exactly 100.0 at 0.1M resolution, or a structured infeasibility naming every binding constraint. Never a partial or best-effort plan.

### 2.2 Effective bounds

For each program, compute an effective `[lo, hi]`:

1. Start from the statutory `[min, max]` in §1.1.
2. Intersect with the change cap: `[baseline × (1 − cap), baseline × (1 + cap)]`, cap defaulting to 0.30 (PRD §14.4).
3. If pinned, collapse to `[current, current]`.
4. If a target applies, raise `lo` (or lower `hi`) to the target.

**Feasibility test:** `Σ lo ≤ 100 ≤ Σ hi`. If `Σ lo > 100`, the request is infeasible and every program whose `lo` exceeds its baseline is a binding constraint, labeled by cause (pin, target, or statutory minimum).

### 2.3 Allocation

Program score is `Σ_o weight[o] × coeff[p][o]`. Because incidence weights sum to 1.0, the citywide effect per $1M equals the coefficient, so district weights do not enter the ranking.

Seed every program at its effective `lo`, then distribute the remainder to programs in descending score order, each up to its effective `hi`. For a linear objective over box constraints with one equality, this greedy fill is the exact LP optimum. No dependency required.

### 2.4 Numerical representation

Represent every dollar value as integer tenths of a million. The greedy allocator starts and ends on that grid, so no rounding pass occurs. Assert that every allocation is an integer and that the total is exactly 1000 internal units ($100.0M). A future continuous-input adapter must use largest-remainder quantization before values cross the engine boundary.

### 2.5 Why the change cap exists

A linear objective always produces corner solutions. Measured: an uncapped solve on the signature weight vector drove **7 of 8 programs onto a hard bound**, simultaneously flooring youth, health, climate and libraries. Under a 30% cap the same solve leaves **2 of 8** on a bound. The cap is the difference between a plan and a stunt. See PRD §14.4.

---

## 3. State shape

### 3.1 Suppression is a mask, never a mutation

This is a P0 requirement even though the counterfactual UI is P1 (PRD §13.1). Get it wrong and the P1 item is unreachable.

```ts
type Suppressible<T> = { value: T; suppressed: boolean };

interface DerivedState {
  // computed, never stored
  outcomes: Record<DistrictId, Record<OutcomeId, number>>;
  bindings: Binding[];
}
```

Coefficients and allocation deltas carry a `suppressed` flag. All outcomes are **computed** from unsuppressed inputs on every read. The counterfactual then costs one flag toggle plus a transition, roughly an hour. Implemented as mutate-and-restore it costs a day, and it will not happen.

Suppression never enters an accepted scenario or a receipt, and auto-clears on accept or discard.

### 3.2 Canonical vs staged

`baseline`, `accepted[]`, and `staged | null` are separate. Selectors must never read `staged` when rendering canonical state. Every tool call carries the state version; a stale version fails with a short instruction to re-call `get_civic_state` (PRD §16.3).

---

## 4. Visual encoding

| State | Encoding |
|---|---|
| Baseline | Solid flow, neutral fill, full opacity |
| Staged proposal | **Dashed** flow, reduced opacity, "proposed" chip |
| Accepted | Solid, saturated, "accepted" chip |
| Constraint violation | Flow suppressed entirely; binding constraint badges in the scenario rail |
| Suppressed (counterfactual) | Desaturated, hatched, strikethrough on the dependent index |
| Cap-held vs statute-held | Different badge; a program held by the 30% cap is not the same claim as one held by law |

Direction and magnitude must be legible without color (PRD §18): every district tile carries an arrow glyph and a numeric delta.

Transitions 500ms ease-out; stagger flows by 40ms in descending magnitude so the eye follows the largest move first. Reduced motion replaces all of it with an immediate swap plus a change list.

---

## 5. Storyboard

Total 150s. The three beats below are 55s of it.

| # | On screen | Tool calls |
|---|---|---|
| 1 | Baseline loads. Eight flows, six tiles, fiction disclosure visible. | `get_civic_state` |
| 2 | Goal stated. Preview 1 animates: housing 15→19.5, transit 14→18.2, funded from youth, climate, emergency. River Ward improves most. | `get_model_details`, `preview_scenario`, `focus_tradeoffs` |
| 3 | Human pins Climate, Youth, Libraries. Activity rail shows `preview_scenario` re-registering; `protectedPrograms` enum drops from 8 entries to 5. `unpin_program` appears. | `get_civic_state` |
| 4 | Human states firm targets (housing 28, transit 22). **Engine returns no plan.** Five binding constraint badges: two target floors, three pins. Required 112.4 vs budget 100. | `preview_scenario` → infeasible |
| 5 | Agent drops the hard targets, re-runs on weights alone with pins held. Feasible. Flows re-animate. | `revise_scenario` |
| 6 | Human accepts. Receipt renders, listing `cf_housing_stability` at low confidence as the weakest input relied upon. | human-only |
| 7 | **P1 if it exists:** human selects `cf_housing_stability`, suppresses it. The stability gain across all six tiles collapses; the cuts remain. Confidence disclosure updates. | `test_assumption` |

Beat 4 is the submission's differentiator and beat 3 is its second. Neither is a chatbot transcript; both are the page asserting itself against the agent.

---

## 6. Build order

| Day | Ship | Gate |
|---|---|---|
| 08-29 | WebMCP spike only: one registered tool, called from ChatGPT's in-app browser | Round-trip confirmed. **PRD §23.1 stop rule fires here.** |
| 08-30 | Fixtures, solver, feasibility test, reducer with mask, manual UI loop | Full loop without WebMCP |
| 08-31 | P0 tool surface, dynamic registration, enum narrowing, activity rail, receipts | Signature flow twice from fresh sessions |
| 09-01 | Accessibility, reduced motion, transitions, evals, deploy. Counterfactual in reserved slot | All acceptance criteria but assets |
| 09-02 | Freeze. Record, edit, publish repo and MIT license, Devpost text | Third party reproduces the flow |
| 09-03 | Blockers only. Submit 12:00 ET | Confirmation captured |

Cut order under pressure: `compare_scenarios`, replay, URL sharing, counterfactual. Never cut: the infeasibility beat, the enum narrowing, the receipt.

---

## 7. Verification log

Run 2026-08-29 against the fixtures above.

- Baseline sums to exactly 100. All eight incidence vectors sum to exactly 1.0.
- **Constraint 6 sweep, n=3000** random weight vectors and 0–2 pins: composite drop exceeded 5 points in **0.0%** of scenarios. Median worst-district drop 0.32, p99 1.19, max 1.29. At a 1.0-point threshold, still 0.0%. Only at 0.5 points does it reach 9.8%. The rule was inert as written and is demoted to a warning (PRD §8.4, item 6).
- **Corner solutions confirmed.** Uncapped solve on the signature weights: 7 of 8 programs on a hard bound. With a 30% cap: 2 of 8. Cap adopted as default.
- **Infeasibility requires targets.** Three pins with no targets: always feasible. Three pins plus `housing ≥ 28`, `transit ≥ 22`: required floor total 112.4 vs budget 100, five binding constraints. Confirms priority weights alone have no failure path.
- Every sampled allocation respected all statutory bounds and closed to exactly 100.0 on the integer-tenths grid across 3,000 trials.

## 8. Open

1. **Resolved 08-29:** Libraries and Digital Access is explicitly **not modeled**. No outcome coefficient represents its value; holding it is a visible human values decision.
2. Coefficient magnitudes are placeholders by construction, but they should not look silly to anyone who has seen a capital budget. Ten minutes of your judgment before anything renders.
3. **Resolved 08-29:** Direction A, Instrument, was selected from the two explored live-workspace directions; the
   third direction was waived in PRD §11 and §24.1 before implementation continued.
