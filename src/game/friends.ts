// Local list of recent online opponents (display names only, no accounts). Stored in localStorage.
import { safeStorage } from "./settings";

export interface Friend {
  id: string;
  name: string;
  lastPlayed: number;
}

export const MAX_FRIENDS = 50;
const KEY = "ludo-live.friends";

export function friendKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Adds names (most recent first), deduping by name ignoring case and keeping at most MAX_FRIENDS. */
export function addFriends(list: readonly Friend[], names: readonly string[], now: number): Friend[] {
  const added: Friend[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 16);
    const id = friendKey(name);
    if (id && !added.some((f) => f.id === id)) added.push({ id, name, lastPlayed: now });
  }
  const rest = list.filter((f) => !added.some((a) => a.id === f.id));
  return [...added, ...rest].slice(0, MAX_FRIENDS);
}

export function removeFriend(list: readonly Friend[], id: string): Friend[] {
  return list.filter((f) => f.id !== id);
}

export function parseFriends(raw: string | null): Friend[] {
  if (!raw) return [];
  try {
    const o: unknown = JSON.parse(raw);
    if (!Array.isArray(o)) return [];
    const out: Friend[] = [];
    for (const x of o as Partial<Friend>[]) {
      if (x && typeof x.name === "string" && typeof x.lastPlayed === "number" && friendKey(x.name)) {
        out.push({ id: friendKey(x.name), name: x.name.trim().slice(0, 16), lastPlayed: x.lastPlayed });
      }
    }
    return out.slice(0, MAX_FRIENDS);
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

export function saveFriends(list: readonly Friend[], storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the list just won't persist.
  }
}
