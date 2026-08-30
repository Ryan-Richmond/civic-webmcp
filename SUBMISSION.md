# Civic — submission package

Status: draft for review. Nothing here is published, deployed, or submitted.

Deliverables required by `PRD.md` section 21, with the state of each:

| Deliverable | State |
|---|---|
| Working live URL | **Not deployed.** Awaiting approval; see "Deployment" below. |
| Public Git repository | **Not published.** Local only, awaiting approval. |
| Open-source license visible | Done. MIT in `LICENSE`. |
| Reproducible local setup | Done. See `README.md`. |
| Text description | Draft below. |
| YouTube demo under three minutes with audio | **Not recorded.** Script below; needs a human voice. |
| Testing instructions | Draft below. |
| Screenshots of the required states | Done. `audit/submission/`, reproducible with `npm run capture`. |

---

## Text description

### What Civic is

Civic is a public-budget studio for the fictional city of Harbor City. A person and a browser agent work on
the same $100.0M discretionary budget across eight programs and six districts. The person states values and
non-negotiable constraints. The agent translates those into structured scenario requests. Civic's deterministic
client-side engine does every piece of arithmetic, rejects infeasible plans, computes illustrative district
outcomes, and updates the page.

Harbor City is invented. The outcome indices are transparent arithmetic over disclosed coefficients, not
forecasts and not evidence of causation. The interface says so on every screen.

### Why WebMCP is the right fit

Civic is not a chat interface with a rendering step. The page is the shared workspace, and WebMCP is what makes
it shared:

- **The agent reads live page state.** `get_civic_state` returns the canonical allocation, the staged proposal,
  the pins, and the current focus, so the agent reasons about what the human is actually looking at.
- **The tool surface changes with the state of the work.** `preview_scenario` becomes `revise_scenario` once a
  proposal is staged, `compare_scenarios` and `discard_preview` appear alongside it, `unpin_program` appears only
  when something is pinned, and `test_assumption` only when a coefficient is selected. The agent discovers what
  is possible right now instead of being told in a prompt.
- **Human constraints narrow the agent's own schema.** Pinning a program removes it from the `protectedPrograms`
  enum. The agent cannot request a change to a pinned program because the schema no longer offers it. This is a
  constraint expressed in the tool contract, not a plea in a system prompt.
- **Mutations are versioned.** Every mutating call carries the `stateVersion` it was written against. A call
  written against stale state is rejected with structured recovery instructions rather than silently applied.
- **The page keeps the decision.** No tool can accept a scenario. Acceptance exists only as a labeled human
  control in the page. The agent can propose all day; it cannot commit.

### The human-agent boundary

The interesting part of this project is where the line sits.

The language model is good at turning "reduce housing instability and improve access to jobs, but do not cut
emergency response" into a weighted request with a protected program. It is bad at arithmetic that must close to
exactly $100.0M, and it should never be the thing that decides a budget.

So Civic gives the model the first job and refuses it the second. All money is integer tenths of a million
internally. The engine constructs allocations directly on that grid, and the receipt does not claim a rounding
pass that never happened. When the request cannot be satisfied, the engine returns no plan and names every
binding constraint, rather than returning the nearest plausible-looking answer.

The strongest demonstration of the boundary is the infeasibility beat. A human pins Youth, Climate, and
Libraries, then states firm floors of $28.0M for housing and $22.0M for transit. Those floors plus those pins
require $112.4M against a $100.0M budget. Civic returns **no plan**, names all five binding constraints, and
changes nothing. The agent recovers by dropping the hard targets and re-running on weights alone, with the pins
still held. The page asserted itself against the agent, and the human's values are the reason.

Pins bind retroactively too: a proposal solved *before* a pin was set cannot be accepted, because it contradicts
the pin. The scenario rail says so and the accept control stays disabled until the agent revises.

### What the human always gets

- Every change is legible without agent prose: a signed delta on each program row, a direction glyph and a
  number on each district tile, and a change list of every program that moved.
- A decision receipt that lists every program that moved with its before and after value, the exact total, the
  pins held, and the coefficients the result relied upon, with their confidence.
- One program, Libraries and Digital Access, is explicitly **not modeled**. No outcome index claims to capture
  its value. Holding it is a visible human values decision that the model cannot argue with.

### Implementation

A static React 19 and TypeScript client built with Vite. No server, no database, no API key, no OpenAI
dependency at runtime. The deterministic core is pure functions with unit and property tests; the property
suite generates weight vectors and pins and asserts every numerical invariant.

- `src/model` — Harbor City fixtures: programs, bounds, districts, incidence weights, coefficients.
- `src/engine` — effective bounds, feasibility, allocation, outcomes, suppression masks.
- `src/state` — the versioned reducer, screen-reader summaries, and the flow-transition clock.
- `src/webmcp` — tool construction, dynamic registration, and `stateVersion` enforcement. One `AbortController`
  per registration generation, so a lifecycle change never leaves a duplicate tool behind.

Motion eases the allocation rather than the DOM, because the chart library remounts its flow paths on every data
change. The flow diagram, the program bars, and the district tiles all render from one clock, and displayed
numbers always read the settled allocation, never an in-flight frame.

40 tests. `npm run check` runs typecheck, tests, and build.

---

## Testing instructions

### Local

```sh
npm install
npm run dev
```

The workspace is designed for a desktop viewport of 1280x720 or wider. A built-in agent harness in the lower
left runs the same engine the WebMCP tools call, so the entire signature flow can be exercised without an agent
present.

### With a WebMCP-capable browser

1. Open the deployed URL, or a local build over `npm run preview`, in a browser with WebMCP enabled. Follow the
   current Chrome instructions at https://developer.chrome.com/docs/ai/webmcp — the flag and availability have
   been changing, so trust that page over any value written here.
2. Confirm the header chip reads **WebMCP live**. It reads **WebMCP unavailable** when `document.modelContext`
   is absent, which is the fastest way to tell a browser-support problem from an app problem.
3. In ChatGPT's in-app browser, open the same URL and ask for the tools. Expect `get_civic_state`,
   `get_model_details`, `focus_tradeoffs`, and `preview_scenario` at baseline.
4. Run the signature prompt: *"Reduce housing instability and improve access to jobs. Do not cut emergency
   response."* Expect a staged proposal moving housing to $19.5M and transit to $18.2M, and expect the tool
   surface to swap `preview_scenario` for `revise_scenario` plus `compare_scenarios` and `discard_preview`.
5. Pin Climate, Youth, and Libraries using the in-page pin controls. Watch the `protectedPrograms` enum in the
   activity rail drop to five entries and `unpin_program` appear.
6. Ask for firm floors: housing $28.0M and transit $22.0M. Expect **no plan**, $112.4M against $100.0M, and five
   named binding constraints.
7. Ask the agent to drop the hard targets. Expect a feasible revision with all three pins still held.
8. Accept in the page. Confirm no tool can do this.

Expect no uncaught console errors at any point. `npm run capture` asserts this automatically.

---

## Demo script — 150 seconds

Shot list matching the `SPEC.md` section 5 storyboard. Times are cumulative.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:12 | Baseline. Eight flows, six district tiles, the fiction disclosure. | "This is Civic. A hundred million dollars, eight programs, six districts, in a city that does not exist. Everything you are about to see is arithmetic you can inspect." |
| 0:12–0:22 | Point at the activity rail's live tool surface. | "The page publishes tools to the browser agent. Right now it offers four." |
| 0:22–0:45 | Type the signature prompt. Flows animate; housing and transit rise, youth, health and climate fall. District tiles move with them. | "I ask for less housing instability and better access to jobs, without cutting emergency response. The agent does not do the math. It sends a structured request, and the page's engine allocates on an exact grid." |
| 0:45–0:58 | Tool surface swaps: revise, compare, discard. | "Because a proposal is now staged, the tools it can call have changed. The agent discovers that from the page." |
| 0:58–1:15 | Pin Climate, Youth, Libraries. `protectedPrograms` drops to five. `unpin_program` appears. Rail warns the staged proposal now contradicts the pins. | "These three are mine. Watch the agent's own schema shrink — it can no longer even ask to move them. And the proposal it made a moment ago is no longer acceptable, because it contradicts what I just said." |
| 1:15–1:35 | Firm targets. **No plan.** $112.4M against $100.0M, five binding constraints. | "Now I ask for something impossible. A chatbot would give me a confident wrong answer. Civic returns no plan, tells me it needs a hundred and twelve point four million, and names all five constraints that make it impossible." |
| 1:35–1:52 | Agent drops the targets, revises. Feasible. Pins intact. | "The agent recovers on its own — it drops the hard floors and re-runs on priorities alone. My three pins are untouched." |
| 1:52–2:15 | Accept in the page. Receipt renders. | "Only I can accept this. No tool can. And the receipt shows every program that moved, the exact total, my pins, and the weakest coefficient the result leaned on — disclosed, at low confidence." |
| 2:15–2:30 | Close on Libraries marked *not modeled*. | "One program is marked not modeled. No index claims to capture what a library is worth. Holding it is a human decision, and the model does not get a vote." |

Recording notes: use a fresh session, 1280x720 or larger, and `Reset demo` between takes. Prefer the real agent
flow; the local harness is the fallback if the browser's WebMCP support is unavailable on recording day.

---

## Deployment

`vercel.json` is committed and configured for a static SPA. **Nothing has been deployed.** When you approve:

```sh
npx vercel --prod
```

This is a static client with no environment variables and no secrets. After the first deploy, verify the live
URL over HTTPS, confirm the WebMCP chip reads **live** in a supporting browser, and re-run the capture against
the deployed origin before recording.
