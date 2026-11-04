# Ludo Live design system and audit

The standard every screen is held to. Read with `docs/FEEL.md` (how it should feel) before changing UI.

## 1. What the category leaders do

Reviewed: the public store listings, screenshots and feature lists of the leading Ludo apps (Ludo King,
Ludo Club, Ludo STAR, Ludo Party) and the top casual board and puzzle games (Monopoly GO, Royal Match),
plus published Ludo UI case studies. Patterns they share, which we adopt in our own art:

| Pattern | Why it works | Ludo Live |
|---|---|---|
| Players sit at the board corners, beside their own yard, with an avatar and the dice in the active seat | Reads as a table with people at it, not a form; eyes stay on the board | Seats in `GameView` via `src/game/table.ts` |
| One dominant Play action above the fold, modes as large colour tiles | A game home, not a menu of links; a returning player is one tap from a roll | Lobby hero card with Play now, mode tiles |
| Profile chip with name and record in the top bar | Identity and progress visible at all times | Profile chip (local stats) |
| Settings, rules and legal behind one gear | Keeps the home screen about playing | Settings sheet |
| Chunky, pressable buttons with a solid lip | Tactile, reads as a game control | `.btn.primary`, `.tile` |
| Board finishes as cosmetics, never pay-to-win | Collectible feel without touching fairness | Classic, Walnut, Marble, Neon |
| Turn timer as a ring around the avatar | Time pressure is visible without text | `.avatar-ring` drains with the online timer |
| Trust messaging on the dice | "Rigged" is the top complaint in the category | Sealed hash chip, explainer, Verify |

We do not copy any app's art, names, layouts pixel for pixel or sounds. Everything here is drawn in code.

## 2. Tokens

**Colour.** Base navy `#0B1026` → `#141B3D`. Accent gold `#F5C451` (lip `#B3861F`, text on gold `#2A1D00`).
Player colours red `#EF3B4F`, green `#22C55E`, yellow `#FACC15`, blue `#3B82F6`, each with `-hi` and `-lo`.
Text `#F4F6FF`, muted `#AAB3D6`. Gold hairline `rgba(245,196,81,.28)` on every raised surface.
Measured contrast: muted on navy 9.1:1, gold on navy 11.6:1, dark text on gold 10.1:1, white on mode tiles
4.9 to 5.7:1.

**Type.** Outfit 700 to 800 for display (titles, names, buttons that start play); Inter for body.
Tabular figures for counts and timers. Everything sized in rem so Large text scales the whole app.

**Shape and depth.** Radius 14 (controls), 20 (seats), 24 (tiles), 28 (hero, sheets), 999 (chips).
Three levels: flat glass, raised (hairline plus soft shadow), pressable (solid lip plus shadow).

**Motion.** Spring `cubic-bezier(.34,1.56,.64,1)` for arrivals, 120ms press, dice throw 600ms with two bounces,
token hop per cell with rising pitch. Every animation has a `prefers-reduced-motion` path.

**Iconography.** One line set in `src/ui/Icon.tsx`: 24px grid, 1.75 stroke, round caps. No emoji in chrome;
emoji appear only as player reactions.

## 3. Components

Lobby: profile chip, language chip, gear · hero card (logo, name, trust line, Play now) · mode tiles ·
recent players. Setup: segmented controls, switches, board finish swatches. Table: seat (avatar ring,
name, pips, tags, dice), board, status line. Sheets and dialogs: settings, rules, fairness, results.

## 4. Audit

Ten criteria, 10 points each. "Before" is main at the start of this pass (3 Nov 2026); "after" is with
#47, #48 and the lobby PR merged.

| # | Criterion (pass condition) | Before | After |
|---|---|---|---|
| 1 | Table: every player seated beside their yard, dice in the active seat | 3 (chip list plus bottom dock) | 10 |
| 2 | Lobby: one primary action above the fold, modes as tiles, no web footer | 3 (stacked list, link footer) | 10 |
| 3 | Visual identity: tokens above used everywhere, one radius and depth scale | 6 | 10 |
| 4 | Iconography: one drawn set, no emoji in chrome | 7 (streak used an emoji) | 10 |
| 5 | Type: display face for hierarchy, tabular numbers | 8 | 10 |
| 6 | Motion: physical dice and tokens, reduced-motion path | 9 | 10 |
| 7 | Access: 44px targets, AA contrast measured, shapes for colour, large text | 8 | 10 |
| 8 | Trust: sealed hash visible in play, explainer, verify after | 9 | 10 |
| 9 | First run: under 30 seconds and at most 3 taps to a roll; 1 tap for returning players | 8 | 10 |
| 10 | Integrity: stylesheet loads whole (a merge had left three rules open), tested | 0 | 10 |
| | **Total** | **61** | **100** |

Polish pass (4 Nov): setup options and settings now share one pill switch (the setup used raw browser
checkboxes at two sizes), and the active seat keeps the dice clear of the name and pips.

The score is against this rubric, checked by tests and screenshots at 400px wide. It is not a store rating:
real player feedback after release is the next measure.
