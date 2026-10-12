import { deriveRoll } from "../engine/fair";
import {
  CATALOG, DEFAULT_EQUIPPED, EMPTY_PROGRESS, KINDS, isUnlocked, loadEquipped, loadProgress, newlyUnlocked, parseProgress,
  recordFinishedGame, recordGame, sanitizeEquipped, saveEquipped, skinProgress, skinsOf, type Equipped,
} from "./cosmetics";

const skin = (id: string) => CATALOG.find((s) => s.id === id)!;

describe("catalog", () => {
  it("has a free default and at least three skins for every kind", () => {
    for (const kind of KINDS) {
      expect(skinsOf(kind).length).toBeGreaterThanOrEqual(3);
      expect(isUnlocked(skin(DEFAULT_EQUIPPED[kind]), EMPTY_PROGRESS)).toBe(true);
    }
  });
  it("has unique ids", () => {
    expect(new Set(CATALOG.map((s) => s.id)).size).toBe(CATALOG.length);
  });
});

describe("progress", () => {
  it("counts games, wins and streaks, and a loss resets only the current streak", () => {
    let p = recordGame(EMPTY_PROGRESS, true);
    p = recordGame(p, true);
    expect(p).toEqual({ games: 2, wins: 2, streak: 2, bestStreak: 2 });
    p = recordGame(p, false);
    expect(p).toEqual({ games: 3, wins: 2, streak: 0, bestStreak: 2 });
  });
  it("unlocks by play and reports distance", () => {
    expect(isUnlocked(skin("midnight"), { ...EMPTY_PROGRESS, games: 2 })).toBe(false);
    expect(skinProgress(skin("midnight"), { ...EMPTY_PROGRESS, games: 1 })).toBeCloseTo(1 / 3);
    expect(isUnlocked(skin("midnight"), { ...EMPTY_PROGRESS, games: 3 })).toBe(true);
    expect(isUnlocked(skin("jade"), { ...EMPTY_PROGRESS, streak: 0, bestStreak: 2 })).toBe(true);
  });
  it("lists skins newly crossed by a game", () => {
    const before = { ...EMPTY_PROGRESS, games: 2 };
    expect(newlyUnlocked(before, recordGame(before, false)).map((s) => s.id)).toEqual(["midnight"]);
  });
  it("parses corrupt storage as empty", () => {
    expect(parseProgress("{nope")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress(JSON.stringify({ games: -4, wins: "x", streak: 3 }))).toEqual({ games: 0, wins: 0, streak: 3, bestStreak: 3 });
  });
});

describe("equipped", () => {
  it("refuses locked or unknown skins", () => {
    const e = sanitizeEquipped({ board: "sunset", dice: "nope", token: "star" }, EMPTY_PROGRESS);
    expect(e).toEqual(DEFAULT_EQUIPPED);
  });
  it("keeps unlocked skins", () => {
    const p = { ...EMPTY_PROGRESS, games: 3 };
    expect(sanitizeEquipped({ board: "midnight" }, p).board).toBe("midnight");
  });
  it("round-trips through storage", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const p = { ...EMPTY_PROGRESS, games: 3 };
    const e: Equipped = { ...DEFAULT_EQUIPPED, board: "midnight" };
    saveEquipped(e, storage);
    expect(loadEquipped(p, storage)).toEqual(e);
    expect(loadEquipped(EMPTY_PROGRESS, storage)).toEqual(DEFAULT_EQUIPPED);
  });
  it("recordFinishedGame persists progress and returns unlocks", () => {
    localStorage.clear();
    recordFinishedGame(true);
    recordFinishedGame(false);
    const unlocked = recordFinishedGame(false);
    expect(loadProgress()).toMatchObject({ games: 3, wins: 1 });
    expect(unlocked.map((s) => s.id)).toEqual(["midnight"]);
  });
});

describe("fairness", () => {
  it("produces an identical roll sequence whichever skins are equipped", async () => {
    const rollsWith = async (e: Equipped) => {
      document.documentElement.dataset.dice = e.dice; // skins live on the DOM only; they are not roll inputs
      return Promise.all(Array.from({ length: 40 }, (_, i) => deriveRoll("seed", ["a", "b"], i)));
    };
    const base = await rollsWith(DEFAULT_EQUIPPED);
    for (const s of skinsOf("dice")) {
      expect(await rollsWith({ ...DEFAULT_EQUIPPED, dice: s.id })).toEqual(base);
    }
  });
});
