import { applyDeltas, eloDeltas, START_RATING } from "./elo";

describe("eloDeltas", () => {
  it("is zero-sum and the winner gains", () => {
    for (const ratings of [[1200, 1200], [1200, 1200, 1200, 1200], [1500, 1000, 1300]]) {
      const d = eloDeltas(ratings);
      expect(d.reduce((a, b) => a + b, 0)).toBe(0);
      expect(d[0]).toBeGreaterThan(0);
      expect(d[d.length - 1]).toBeLessThan(0);
    }
  });
  it("two equal players swing by K/2 = 16", () => {
    expect(eloDeltas([1200, 1200])).toEqual([16, -16]);
  });
  it("an upset gains more than an expected win", () => {
    const upset = eloDeltas([1000, 1400])[0];
    const expected = eloDeltas([1400, 1000])[0];
    expect(upset).toBeGreaterThan(expected);
  });
  it("handles a single player", () => {
    expect(eloDeltas([1200])).toEqual([0]);
  });
});

describe("applyDeltas", () => {
  it("never drops below 0", () => {
    expect(applyDeltas(5, -20)).toBe(0);
    expect(applyDeltas(START_RATING, 16)).toBe(1216);
  });
});
