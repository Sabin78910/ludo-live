// Sparks: a free, earn-only reward that unlocks cosmetic dice skins. Earned by playing and by a daily
// chest. Never sold, never needed to play, never affects a roll. Stored on this device only.
import { safeStorage } from "./settings";

export const DICE_SKINS = ["classic", "ruby", "jade", "sunset", "galaxy"] as const;
export type DiceSkin = (typeof DICE_SKINS)[number];
export const SKIN_COST: Record<DiceSkin, number> = { classic: 0, ruby: 60, jade: 60, sunset: 120, galaxy: 200 };

export const WIN_SPARKS = 20;
export const PLAY_SPARKS = 5;
/** The chest always pays; only the size varies. */
export const CHEST_MIN = 15;
export const CHEST_MAX = 40;

export interface Rewards {
  sparks: number;
  owned: DiceSkin[];
  /** Local date (YYYY-MM-DD) the chest was last opened. */
  chestDay: string | null;
}

const KEY = "ludo-live.rewards";
export const emptyRewards = (): Rewards => ({ sparks: 0, owned: ["classic"], chestDay: null });

export const chestReady = (r: Rewards, today: string) => r.chestDay !== today;

export function openChest(r: Rewards, today: string, rand: () => number = Math.random): { rewards: Rewards; amount: number } | null {
  if (!chestReady(r, today)) return null;
  const amount = CHEST_MIN + Math.floor(rand() * (CHEST_MAX - CHEST_MIN + 1));
  return { rewards: { ...r, sparks: r.sparks + amount, chestDay: today }, amount };
}

export const earnForGame = (r: Rewards, won: boolean): Rewards => ({ ...r, sparks: r.sparks + PLAY_SPARKS + (won ? WIN_SPARKS : 0) });

export function unlockSkin(r: Rewards, skin: DiceSkin): Rewards | null {
  if (r.owned.includes(skin) || r.sparks < SKIN_COST[skin]) return null;
  return { ...r, sparks: r.sparks - SKIN_COST[skin], owned: [...r.owned, skin] };
}

export function parseRewards(raw: string | null): Rewards {
  if (!raw) return emptyRewards();
  try {
    const o = JSON.parse(raw) as Partial<Rewards>;
    const owned = Array.isArray(o.owned) ? o.owned.filter((s): s is DiceSkin => DICE_SKINS.includes(s as DiceSkin)) : [];
    return {
      sparks: typeof o.sparks === "number" && Number.isFinite(o.sparks) && o.sparks >= 0 ? Math.floor(o.sparks) : 0,
      owned: Array.from(new Set<DiceSkin>(["classic", ...owned])),
      chestDay: typeof o.chestDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.chestDay) ? o.chestDay : null,
    };
  } catch {
    return emptyRewards();
  }
}

export function loadRewards(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Rewards {
  try {
    return parseRewards(storage?.getItem(KEY) ?? null);
  } catch {
    return emptyRewards();
  }
}

export function saveRewards(r: Rewards, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(r));
  } catch {
    /* storage blocked: rewards last for this visit */
  }
}
