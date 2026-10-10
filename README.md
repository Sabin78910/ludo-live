# Ludo Live

Online multiplayer Ludo built to beat the "rigged dice" complaint: **every roll is provably fair**.

**Play:** https://sabin78910.github.io/ludo-live/

## Features
- **Provably fair dice** (commit-reveal). The dealer publishes `SHA-256(seed)` before the first roll; roll *n* is
  the first byte `b < 252` of `HMAC-SHA256(seed, clientSeeds.join("|") + ":" + n)`, mapped to `(b mod 6) + 1`
  (no modulo bias). The seed is revealed at the end and the **Verify fairness** screen recomputes every roll in the browser.
  The same scheme runs in bot games and online rooms.
- Modes: vs smart bots (easy / normal / hard: capture, safety, progress), pass-and-play (2–4), and **online rooms**
  (6-character code, WhatsApp/share invite link `?room=CODE`, server-authoritative moves, rejoin with a token,
  a bot takes over after 30 s offline, 20 s turn timer, emoji reactions).
- Classic rules: 52-cell track, home columns, safe stars and start squares, 6 to leave base, three 6s forfeit the
  turn, capture = bonus roll, exact roll to finish, full winner order. **Quick mode**: one token starts out, first home wins.
- Premium 3D-tilted board, glossy tokens, 3D dice, spring hops cell by cell, capture bursts, confetti podium,
  WebAudio sound effects, haptics, reduced-motion support. English + Nepali. **No ads in matches.**
- PWA (offline, installable) and a Capacitor Android app (AAB built in CI).

## Develop
```bash
npm ci
npm run dev          # http://localhost:5173
npm test && npm run lint && npm run typecheck && npm run build
cd worker && npm ci && npx wrangler dev   # local rooms; then VITE_WS_URL=ws://localhost:8787 in .env.development.local
```

## Online backend (Cloudflare)
`worker/` is a Cloudflare Worker with one Durable Object per room (`wrangler.toml`, SQLite-backed DOs work on the free plan).
`.github/workflows/worker-deploy.yml` deploys it only when the `CLOUDFLARE_API_TOKEN` secret exists. The site reads the
WebSocket URL from the `VITE_WS_URL` repo variable at build time; without it, online mode shows "Online coming soon".

## Design
Deep navy `#0B1026` with glass, classic Ludo red `#EF3B4F`, green `#22C55E`, yellow `#FACC15`, blue `#3B82F6`,
gold `#F5C451` for wins. Outfit (display) + Inter + Noto Sans Devanagari. 44 px touch targets, AA contrast.

Screenshots: `docs/screenshots/`. Privacy: https://sabin78910.github.io/privacy-policy/
