# Ludo Live – UAT & VAPT report

**Build:** 1.0.0 (web build from `main` at de11146) · Capacitor 8 Android, target API 36, min API 24
**Date:** 3 Nov 2026 · **Device:** headless Chromium at 360×640 (phone), dark theme, reduced motion
**Automated tests:** 144/144 Vitest tests pass (engine, fairness, bots, protocol, room server, client, app).
Lint and typecheck clean. Android CI built the release AAB on `main` (run 27, green).

Not yet run: a pass on a real Android phone and an online-room test against a deployed Worker
(the Worker is not deployed yet; see `LAUNCH.md`). Do both on the internal testing track before production.

## 1. UAT (user acceptance testing)

| # | Scenario | Result |
|---|---|---|
| 1 | Home screen loads offline-ready, no console or page errors | ✅ Pass |
| 2 | Language switch English ⇄ Nepali, follows a Nepali phone locale on first launch | ✅ Pass |
| 3 | Play vs bots setup: name, 2/3/4 players, Easy/Normal/Hard, Quick mode | ✅ Pass |
| 4 | Full 4-player game vs bots played to the end by an automated player (tap dice, pick tokens) | ✅ Pass |
| 5 | Quick mode game to the podium: "You win!", places 1st to 4th | ✅ Pass |
| 6 | Toasts: "Six! Roll again" and capture bonus | ✅ Pass |
| 7 | Verify fairness: published hash matches the revealed seed, every roll recomputed (8 games, e.g. "158 of 158 rolls verified") | ✅ Pass |
| 8 | Online card without a server shows "Online coming soon" instead of failing | ✅ Pass (expected until the Worker is deployed) |
| 9 | Online room: create, share code, join, rejoin, bot takeover after 30 s, turn timer | ⏭ Covered by `worker/src/room.test.ts` and `src/online/client.test.ts`; needs a live test after deploy |
| 10 | Android back button, notch / gesture bar safe areas | ⏭ Safe areas are fixed in PR #32; check on a phone |

Store screenshots 4 to 7 in `store/screenshots/` come from these runs at 1080×1920.

## 2. VAPT (vulnerability assessment)

**Scope:** the web build, the Android project in `android/`, the Worker in `worker/`, and the repository.

### Passed checks
- Permissions are minimal: `INTERNET` only.
- Only the launcher activity is exported; the FileProvider is not exported.
- Not debuggable in release; cleartext HTTP is off (target API 36 default); online play uses WSS only.
- No secrets in the code or the repo; signing keys are GitHub secrets, not files. No `.env` files committed.
- The server is authoritative: the client sends intents, the Durable Object validates every move and rolls the dice.
- Dice use commit and reveal (SHA-256 commitment, HMAC-SHA256 rolls with rejection sampling, no modulo bias), and
  every player's client seed is mixed in, so neither the server nor a player can pick rolls.
- Display names are stripped of control characters and `<` `>` and capped in length (`cleanName`); React escapes output.
- Rooms delete their storage about 6 hours after everyone leaves (`IDLE_EXPIRY_MS`).
- `npm audit` dependency fixes are ready in PR #34.

### Findings
| ID | Severity | Finding | Status / recommendation |
|---|---|---|---|
| L1 | Medium | Online mode is "coming soon" until the Worker is deployed and `VITE_WS_URL` is set, but the listing advertises online play. | Deploy the Worker before the production release (steps in `LAUNCH.md`), or remove the online lines from the listing for 1.0. |
| L2 | Low | Display names are free text with no profanity filter or report option; strangers can see them if a room code leaks. | Open. Port Block Drop's `NameFilter` idea to `cleanName`, or keep rooms invite-only (they are: a 6-character code is needed). |
| L3 | Low | No per-IP rate limit on room creation at the Worker. | Open. Add a Cloudflare rate-limiting rule on the Worker route if abuse shows up; free plan limits cap cost. |
| L4 | Info | Android Auto Backup is on, so settings can be restored on a new phone. | Accepted: nothing sensitive is stored. |
