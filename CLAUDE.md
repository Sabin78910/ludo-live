# Ludo Live
Purpose: Online multiplayer Ludo (React 19, TS, Vite PWA + Capacitor Android) with provably fair dice,
smart bots, pass-and-play and online rooms on a Cloudflare Worker + Durable Objects.

## Commands
- Test: `npm test` (engine, worker room logic, client)
- Lint: `npm run lint && npm run typecheck` (typecheck also checks `worker/`)
- Build: `npm run build`
- Worker: `cd worker && npm ci && npx wrangler dev` (local rooms on :8787; set `VITE_WS_URL=ws://localhost:8787` in `.env.development.local`)

## Architecture
- `src/engine/` pure shared rules (rules.ts, board.ts, bot.ts, fair.ts, protocol.ts). Used by BOTH client and Worker. No DOM.
- `worker/src/room.ts` authoritative room logic (pure, unit tested); `worker/src/index.ts` Durable Object + WebSocket glue.
- `src/game/` client logic (local game hook, animation frames, i18n EN+NE, settings, sound); `src/online/` WebSocket client.
- `src/ui/` components. Styles in `src/index.css`.

## Rules
- Read only the files you need; do not scan the whole repo.
- Every behavior change needs a test. Run tests and lint before finishing.
- Engine changes must keep client and server in sync (same module). Never change the fair-dice derivation
  (`fair.ts`) without a migration plan: old games must still verify.
- No ads during matches. No dark patterns.
- No new dependencies, permissions, or signing/secrets changes without asking.
- Never commit secrets, keystores, .env files.
- Keep PRs under ~300 changed lines; one issue per PR.
- Be concise: diffs plus a 3-line summary.
- If tests still fail after 3 attempts, stop and report the blocker.

## Definition of done
Lint clean, tests pass, CI green, short summary, PR opened as draft.
