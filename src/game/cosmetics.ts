// Earned cosmetics: board, dice and token skins unlocked by play, never by payment. Skins are pure CSS
// (see index.css, keyed on data-board / data-dice / data-token) and are never an input to the dice.
import { safeStorage } from "./settings";

export type SkinKind = "board" | "dice" | "token";
export type Stat = "games" | "wins" | "streak";

export interface Skin {
  id: string;
  kind: SkinKind;
  stat: Stat;
  /** Value of `stat` needed to unlock. 0 means available from the start. */
  need: number;
}

export interface Progress {
  games: number;
  wins: number;
  streak: number;
  bestStreak: number;
}

export type Equipped = Record<SkinKind, string>;

export const KINDS: readonly SkinKind[] = ["board", "dice", "token"];

export const CATALOG: readonly Skin[] = [
  { id: "classic", kind: "board", stat: "games", need: 0 },
  { id: "midnight", kind: "board", stat: "games", need: 3 },
  { id: "sunset", kind: "board", stat: "wins", need: 5 },
  { id: "forest", kind: "board", stat: "streak", need: 3 },
  { id: "ivory", kind: "dice", stat: "games", need: 0 },
  { id: "obsidian", kind: "dice", stat: "games", need: 5 },
  { id: "amber", kind: "dice", stat: "wins", need: 3 },
  { id: "jade", kind: "dice", stat: "streak", need: 2 },
  { id: "round", kind: "token", stat: "games", need: 0 },
  { id: "diamond", kind: "token", stat: "games", need: 8 },
  { id: "square", kind: "token", stat: "wins", need: 1 },
  { id: "star", kind: "token", stat: "streak", need: 4 },
];

export const DEFAULT_EQUIPPED: Equipped = { board: "classic", dice: "ivory", token: "round" };
export const EMPTY_PROGRESS: Progress = { games: 0, wins: 0, streak: 0, bestStreak: 0 };

const PROGRESS_KEY = "ludo-live.progress";
const EQUIP_KEY = "ludo-live.equipped";

export function skinsOf(kind: SkinKind): Skin[] {
  return CATALOG.filter((s) => s.kind === kind);
}

/** Current value of a skin's unlock stat. A streak unlocks on the best run, so it is never lost. */
export function statValue(p: Progress, stat: Stat): number {
  return stat === "streak" ? p.bestStreak : p[stat];
}

export function isUnlocked(skin: Skin, p: Progress): boolean {
  return statValue(p, skin.stat) >= skin.need;
}

/** 0..1 distance to unlocking, so the collection can always show how close a skin is. */
export function skinProgress(skin: Skin, p: Progress): number {
  return skin.need === 0 ? 1 : Math.min(1, statValue(p, skin.stat) / skin.need);
}

/** Skins whose unlock was crossed by a change from `before` to `after`. */
export function newlyUnlocked(before: Progress, after: Progress): Skin[] {
  return CATALOG.filter((s) => !isUnlocked(s, before) && isUnlocked(s, after));
}

/** Record a finished game. Only players with a seat on this device earn progress. */
export function recordGame(p: Progress, won: boolean): Progress {
  const streak = won ? p.streak + 1 : 0;
  return { games: p.games + 1, wins: p.wins + (won ? 1 : 0), streak, bestStreak: Math.max(p.bestStreak, streak) };
}

/** Falls back to the default skin for any kind that is unknown or still locked. */
export function sanitizeEquipped(raw: Partial<Record<SkinKind, unknown>> | null | undefined, p: Progress): Equipped {
  const out = { ...DEFAULT_EQUIPPED };
  for (const kind of KINDS) {
    const skin = CATALOG.find((s) => s.kind === kind && s.id === raw?.[kind]);
    if (skin && isUnlocked(skin, p)) out[kind] = skin.id;
  }
  return out;
}

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function parseProgress(raw: string | null): Progress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const o = JSON.parse(raw) as Partial<Progress>;
    const streak = count(o.streak);
    return { games: count(o.games), wins: count(o.wins), streak, bestStreak: Math.max(count(o.bestStreak), streak) };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function loadProgress(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Progress {
  try {
    return parseProgress(storage?.getItem(PROGRESS_KEY) ?? null);
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(p: Progress, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress just won't persist.
  }
}

export function loadEquipped(p: Progress, storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Equipped {
  try {
    return sanitizeEquipped(JSON.parse(storage?.getItem(EQUIP_KEY) ?? "null"), p);
  } catch {
    return { ...DEFAULT_EQUIPPED };
  }
}

export function saveEquipped(e: Equipped, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(EQUIP_KEY, JSON.stringify(e));
  } catch {
    // Storage unavailable: the choice just won't persist.
  }
}

/** Record a finished game in storage and return the skins it unlocked. */
export function recordFinishedGame(won: boolean, storage: Storage | undefined = safeStorage()): Skin[] {
  const before = loadProgress(storage);
  const after = recordGame(before, won);
  saveProgress(after, storage);
  return newlyUnlocked(before, after);
}

export function applyEquipped(e: Equipped, el: HTMLElement = document.documentElement): void {
  el.dataset.board = e.board;
  el.dataset.dice = e.dice;
  el.dataset.token = e.token;
}
