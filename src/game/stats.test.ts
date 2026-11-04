import { emptyStats, liveStreak, parseStats, recordGame, trophyProgress } from "./stats";

describe("stats", () => {
  it("counts games and wins and starts a streak", () => {
    const s = recordGame(recordGame(emptyStats(), true, "2026-10-18"), false, "2026-10-18");
    expect(s).toMatchObject({ played: 2, won: 1, streak: 1, bestStreak: 1 });
  });
  it("extends the streak on consecutive days, even across a month end", () => {
    const s = recordGame(recordGame(emptyStats(), true, "2026-09-30"), true, "2026-10-01");
    expect(s.streak).toBe(2);
  });
  it("resets the streak after a gap but keeps the best", () => {
    const s = recordGame(recordGame(recordGame(emptyStats(), true, "2026-10-10"), true, "2026-10-11"), true, "2026-10-14");
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
  });
  it("hides a stale streak on the home screen", () => {
    const s = recordGame(emptyStats(), true, "2026-10-10");
    expect(liveStreak(s, "2026-10-11")).toBe(1);
    expect(liveStreak(s, "2026-10-13")).toBe(0);
  });
  it("survives corrupt storage", () => {
    expect(parseStats("{nope")).toEqual(emptyStats());
    expect(parseStats('{"played":-4,"won":9,"lastDay":"x"}')).toEqual(emptyStats());
  });
});

describe("trophyProgress", () => {
  it("shows distance to the next trophy and flags a freshly earned one", () => {
    expect(trophyProgress(0)).toEqual({ prev: 0, next: 1, fraction: 0, fresh: false });
    expect(trophyProgress(4)).toEqual({ prev: 3, next: 5, fraction: 0.5, fresh: false });
    expect(trophyProgress(10)).toMatchObject({ prev: 10, next: 25, fraction: 0, fresh: true });
    expect(trophyProgress(5000)).toMatchObject({ next: null, fraction: 1 });
  });
});
