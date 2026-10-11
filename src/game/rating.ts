// Ranked rating kept on this device only. `last` is the id of the last game applied, so a reload never counts a result twice.
import { START_RATING, applyDeltas } from "../engine/elo";
import { safeStorage } from "./settings";

export interface Rating {
  rating: number;
  last: string | null;
}

const KEY = "ludo-live.rating";

export function parseRating(raw: string | null): Rating {
  try {
    const o = JSON.parse(raw ?? "null") as Partial<Rating> | null;
    const ok = o && typeof o.rating === "number" && Number.isFinite(o.rating) && o.rating >= 0;
    return { rating: ok ? Math.round(o.rating as number) : START_RATING, last: ok && typeof o.last === "string" ? o.last : null };
  } catch {
    return { rating: START_RATING, last: null };
  }
}

export function loadRating(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Rating {
  try {
    return parseRating(storage?.getItem(KEY) ?? null);
  } catch {
    return parseRating(null);
  }
}

export function applyGameResult(delta: number, gameId: string, storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeStorage()): Rating {
  const cur = loadRating(storage);
  if (cur.last === gameId) return cur;
  const next = { rating: applyDeltas(cur.rating, delta), last: gameId };
  try {
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: the rating just won't persist.
  }
  return next;
}
