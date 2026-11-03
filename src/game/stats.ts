// Local play stats: games, wins and a daily play streak. Stored on this device only.
import { safeStorage } from "./settings";

export interface Stats {
  played: number;
  won: number;
  /** Consecutive days with at least one finished game. */
  streak: number;
  bestStreak: number;
  /** Local date (YYYY-MM-DD) of the last finished game. */
  lastDay: string | null;
}

const KEY = "ludo-live.stats";

export const emptyStats = (): Stats => ({ played: 0, won: 0, streak: 0, bestStreak: 0, lastDay: null });

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayBefore(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** Records a finished game. `won` is true only when a human beat the bots. */
export function recordGame(s: Stats, won: boolean, today: string): Stats {
  const streak = s.lastDay === today ? s.streak : s.lastDay === dayBefore(today) ? s.streak + 1 : 1;
  return { played: s.played + 1, won: s.won + (won ? 1 : 0), streak, bestStreak: Math.max(s.bestStreak, streak), lastDay: today };
}

/** The streak still counts on the home screen if the last game was today or yesterday. */
export function liveStreak(s: Stats, today: string): number {
  return s.lastDay === today || s.lastDay === dayBefore(today) ? s.streak : 0;
}

export function parseStats(raw: string | null): Stats {
  if (!raw) return emptyStats();
  try {
    const o = JSON.parse(raw) as Partial<Stats>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    return {
      played: n(o.played),
      won: Math.min(n(o.won), n(o.played)),
      streak: n(o.streak),
      bestStreak: n(o.bestStreak),
      lastDay: typeof o.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.lastDay) ? o.lastDay : null,
    };
  } catch {
    return emptyStats();
  }
}

export function loadStats(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Stats {
  try {
    return parseStats(storage?.getItem(KEY) ?? null);
  } catch {
    return emptyStats();
  }
}

export function saveStats(s: Stats, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or full storage: stats just won't persist.
  }
}
