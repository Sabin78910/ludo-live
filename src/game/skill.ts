// On-device skill rating for "Auto" bot level. A small Elo model learns how strong the player is from
// their own wins and losses against bots, then picks the bot tier closest to an even match.
// Nothing leaves the device, and only game results feed it: never purchases, time spent or ads.
import type { Difficulty } from "../engine/bot";
import { safeStorage } from "./settings";

export const START_RATING = 1000;
/** Rough strength of each bot tier on the same scale. */
export const TIER_RATING: Record<Difficulty, number> = { easy: 850, normal: 1050, hard: 1250 };
const K = 32;
const KEY = "ludo-live.skill";

/** Chance a player rated `a` beats `b`, with `field` opponents (1 in 2 player games). */
export function expected(a: number, b: number, field = 1): number {
  const head = 1 / (1 + 10 ** ((b - a) / 400));
  // Against several bots you need to beat all of them, so an even player wins 1 in (field + 1).
  return head / (head + field * (1 - head));
}

export function updateRating(rating: number, tier: Difficulty, won: boolean, bots = 1): number {
  const e = expected(rating, TIER_RATING[tier], Math.max(1, bots));
  const next = rating + K * ((won ? 1 : 0) - e);
  return Math.round(Math.min(2000, Math.max(400, next)));
}

/** The tier whose strength is closest to the player's, so games stay close. */
export function pickDifficulty(rating: number): Difficulty {
  let best: Difficulty = "normal";
  for (const d of ["easy", "normal", "hard"] as const) {
    if (Math.abs(TIER_RATING[d] - rating) < Math.abs(TIER_RATING[best] - rating)) best = d;
  }
  return best;
}

export function parseRating(raw: string | null): number {
  const n = Number(raw);
  return raw !== null && Number.isFinite(n) && n >= 400 && n <= 2000 ? Math.round(n) : START_RATING;
}

export function loadRating(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): number {
  try {
    return parseRating(storage?.getItem(KEY) ?? null);
  } catch {
    return START_RATING;
  }
}

export function saveRating(r: number, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, String(r));
  } catch {
    /* storage full or blocked: the rating simply resets next time */
  }
}
