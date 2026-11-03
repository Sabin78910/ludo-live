// People you have played online with, kept on this device only (no account, nothing uploaded).
// The home screen offers them as a one-tap "play again" that opens a fresh room to share.
import { safeStorage } from "./settings";

export interface Friend {
  name: string;
  /** Epoch ms of the last game together. */
  last: number;
  games: number;
}

const KEY = "ludo-live.friends";
export const MAX_FRIENDS = 8;

const clean = (name: string) => name.trim().slice(0, 16);

/** Adds the human players of a game you just started, newest first, deduplicated by name. */
export function rememberPlayers(list: Friend[], names: string[], now: number): Friend[] {
  const next = [...list];
  for (const raw of names) {
    const name = clean(raw);
    if (!name) continue;
    const i = next.findIndex((f) => f.name.toLowerCase() === name.toLowerCase());
    const prev = i >= 0 ? next.splice(i, 1)[0] : null;
    next.unshift({ name, last: now, games: (prev?.games ?? 0) + 1 });
  }
  return next.sort((a, b) => b.last - a.last).slice(0, MAX_FRIENDS);
}

export function forgetFriend(list: Friend[], name: string): Friend[] {
  return list.filter((f) => f.name !== name);
}

export function parseFriends(raw: string | null): Friend[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((f): f is Friend => !!f && typeof f.name === "string" && typeof f.last === "number" && typeof f.games === "number")
      .map((f) => ({ name: clean(f.name), last: f.last, games: Math.max(1, Math.floor(f.games)) }))
      .filter((f) => f.name)
      .slice(0, MAX_FRIENDS);
  } catch {
    return [];
  }
}

export function loadFriends(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Friend[] {
  try {
    return parseFriends(storage?.getItem(KEY) ?? null);
  } catch {
    return [];
  }
}

export function saveFriends(list: Friend[], storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: the list just won't persist.
  }
}
