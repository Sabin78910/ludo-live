// Weekly tournament rules. Everything derives from the ISO week, so no event is ever configured by hand.

export interface WeekId {
  year: number;
  week: number;
  /** e.g. "2026-W42" */
  key: string;
}

export interface Twist {
  label: string;
  /** Quick mode is forced. */
  quick: boolean;
  /** Required table size, or null for any size. */
  players: number | null;
}

export interface Rung {
  wins: number;
  /** Cosmetic reward id; rewards never affect play. */
  reward: string;
  title: string;
}

export const LADDER: readonly Rung[] = [
  { wins: 1, reward: "token-spark", title: "Spark tokens" },
  { wins: 3, reward: "dice-aurora", title: "Aurora dice" },
  { wins: 5, reward: "board-nebula", title: "Nebula board" },
  { wins: 10, reward: "crown-gold", title: "Golden crown" },
];

const TWISTS: readonly Twist[] = [
  { label: "Quick mode only", quick: true, players: null },
  { label: "3 player tables", quick: false, players: 3 },
  { label: "Quick 3 player tables", quick: true, players: 3 },
];

/** ISO 8601 week (weeks start Monday, in UTC). */
export function isoWeek(date: Date): WeekId {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // the Thursday decides the year
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week, key: `${year}-W${String(week).padStart(2, "0")}` };
}

export function isWeekKey(key: unknown): key is string {
  return typeof key === "string" && /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(key);
}

/** The rule twist for a week. Consecutive weeks never repeat. */
export function weekTwist(key: string): Twist {
  const [y, w] = key.split("-W").map(Number);
  return TWISTS[(y * 53 + w) % TWISTS.length];
}

export function rewardsEarned(wins: number): Rung[] {
  return LADDER.filter((r) => wins >= r.wins);
}

/** The next rung and how far away it is, or null when the ladder is complete. */
export function nextRung(wins: number): (Rung & { remaining: number }) | null {
  const r = LADDER.find((x) => wins < x.wins);
  return r ? { ...r, remaining: r.wins - wins } : null;
}
