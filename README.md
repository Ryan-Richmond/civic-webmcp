# Civic

Civic is a WebMCP-enabled public-budget studio where a person and an agent build, inspect, and compare transparent scenarios for fictional Harbor City.

The language model expresses intent. Civic's deterministic client-side engine owns arithmetic, feasibility, versioning, and the distinction between staged and accepted state.

## Status

The product contract is in `PRD.md`, implementation details are in `SPEC.md`, and the issue-ready build sequence is in `IMPLEMENTATION_PLAN.md`.

The current build is local-only. Vercel is the preferred first deployment target because Civic is a static client and requires no managed database, authentication service, or API key.

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

## Product boundaries

- Harbor City and all outcomes are fictional and illustrative.
- The browser agent cannot accept a scenario.
- WebMCP mutations stage reversible previews only.
- No OpenAI API key or server-side database is required.

## License

MIT. See `LICENSE`.

