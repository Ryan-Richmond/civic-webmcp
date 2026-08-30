# Civic

Civic is a WebMCP-enabled public-budget studio where a person and an agent build, inspect, and compare transparent scenarios for fictional Harbor City.

The language model expresses intent. Civic's deterministic client-side engine owns arithmetic, feasibility, versioning, and the distinction between staged and accepted state.

## Status

The product contract is in `PRD.md`, implementation details are in `SPEC.md`, the build sequence and its
verification gates are in `IMPLEMENTATION_PLAN.md`, and the design and accessibility QA record is in
`design-qa.md`. Submission materials, testing instructions, and the demo script are in `SUBMISSION.md`.

The current build is local-only and has not been deployed. Vercel is the preferred first target because Civic is
a static client and requires no managed database, authentication service, or API key.

## Local development

Requirements:

- Node.js 22 or newer
- npm 11 or newer

```sh
npm install
npm run dev
```

Validation:

```sh
npm run check
```

`check` runs the TypeScript project build, the unit and property suites, and the production build.

Submission screenshots, captured from the production build by driving a real Chrome through the whole signature
flow and asserting on the page's own text at every step:

```sh
npm run capture
```

Output lands in `audit/submission/` at 1280x720 CSS pixels, 2x scale. The run fails if any step is missing or
disabled, or if the flow produces a single console error or failed request.

## Using it without an agent

The workspace targets a desktop viewport of 1280x720 or wider. An agent harness in the lower left runs the same
deterministic engine the WebMCP tools call, so the full flow — proposal, pins, infeasibility, recovery,
acceptance, receipt — can be exercised with no agent present. The header chip reports whether WebMCP is live in
the current browser.

See `SUBMISSION.md` for WebMCP testing instructions.

## Product boundaries

- Harbor City and all outcomes are fictional and illustrative.
- The browser agent cannot accept a scenario.
- WebMCP mutations stage reversible previews only.
- No OpenAI API key or server-side database is required.
- Human pins bind every plan, including a proposal that was solved before the pin was set.
- Money is integer tenths of a million throughout; allocations are built on that grid and close to exactly $100.0M.

## License

MIT. See `LICENSE`.

