# Ludo Live
Online Ludo with provably fair dice, smart bots and pass and play.

## Stack
React 19 · TypeScript (strict) · Vite · Vitest · ESLint. Installable PWA with offline support.
Design: deep navy #0B1026 with glass, classic Ludo red, green, yellow and blue, Outfit.

## Commands
- Dev: `npm run dev` · Build: `npm run build`
- Test: `npm test` · Lint: `npm run lint && npm run typecheck`

## Architecture
- `src/engine/` pure rules, shared by client and server · `worker/` Cloudflare Durable Object per room
- The server is authoritative for every move; the client never decides a roll.

## Data rules
- Rooms live in a Durable Object keyed by a 6 character code. `VITE_WS_URL` points at the Worker.
- Dice use commit and reveal: publish SHA-256(seed) before play, reveal the seed after. Never change this
  scheme without keeping the Verify fairness screen correct.

## Testing rules
- Every behaviour change needs a test. Pure logic in `src/*.ts` is unit-tested; components get the
  behaviour test, not the markup. Run lint, typecheck and tests before finishing.

## Frontend rules
- Keep the existing design system, dark-first with a working light theme. Editorial layouts, not dashboard
  grids. Respect `prefers-reduced-motion`, keep AA contrast and 44px targets.
- Self-host fonts with @fontsource; a Google Fonts link blocks first paint and costs ~2s on mobile.
- Keep gzipped JS under ~180KB and Lighthouse mobile performance at 90+.

## Security and git
- Never commit secrets, keystores, .env files or email addresses.
- Keep the Content-Security-Policy strict; add a host to connect-src only when a feature needs it.
- `main` is protected: branch, open a PR, merge when CI is green. One issue per PR, under ~300 lines.

## Done when
Lint clean, tests pass, CI green, PR opened with a three line summary. User facing work follows `docs/FEEL.md`.
