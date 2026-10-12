import { LADDER, isoWeek, nextRung, rewardsEarned, weekTwist } from "./tournament";

describe("isoWeek", () => {
  it("computes ISO weeks, including year boundaries", () => {
    expect(isoWeek(new Date("2026-10-12T10:00:00Z")).key).toBe("2026-W42");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z")).key).toBe("2026-W53");
    expect(isoWeek(new Date("2024-12-30T00:00:00Z")).key).toBe("2025-W01");
  });
  it("rolls over on Monday UTC", () => {
    expect(isoWeek(new Date("2026-10-11T23:59:59Z")).key).toBe("2026-W41");
    expect(isoWeek(new Date("2026-10-12T00:00:00Z")).key).toBe("2026-W42");
  });
});

describe("weekTwist", () => {
  it("is deterministic per week", () => {
    expect(weekTwist("2026-W42")).toEqual(weekTwist("2026-W42"));
  });
  it("changes every consecutive week and always forces something", () => {
    for (let w = 1; w < 52; w++) {
      const a = weekTwist(`2026-W${String(w).padStart(2, "0")}`);
      const b = weekTwist(`2026-W${String(w + 1).padStart(2, "0")}`);
      expect(a.label).not.toBe(b.label);
      expect(a.quick || a.players !== null).toBe(true);
    }
  });
});

describe("ladder", () => {
  it("has cosmetic rewards at 1, 3, 5 and 10 wins", () => {
    expect(LADDER.map((r) => r.wins)).toEqual([1, 3, 5, 10]);
  });
  it("unlocks rewards as wins grow", () => {
    expect(rewardsEarned(0)).toEqual([]);
    expect(rewardsEarned(3).map((r) => r.wins)).toEqual([1, 3]);
    expect(rewardsEarned(12)).toHaveLength(4);
  });
  it("shows the distance to the next rung", () => {
    expect(nextRung(0)).toMatchObject({ wins: 1, remaining: 1 });
    expect(nextRung(4)).toMatchObject({ wins: 5, remaining: 1 });
    expect(nextRung(10)).toBeNull();
  });
});
