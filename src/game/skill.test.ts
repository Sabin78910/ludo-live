import { describe, expect, it } from "vitest";
import { expected, parseRating, pickDifficulty, START_RATING, TIER_RATING, updateRating } from "./skill";

describe("on-device skill rating", () => {
  it("an even player has a fair share of the win", () => {
    expect(expected(1000, 1000)).toBeCloseTo(0.5);
    expect(expected(1000, 1000, 3)).toBeCloseTo(0.25);
  });

  it("wins raise the rating and losses lower it", () => {
    expect(updateRating(START_RATING, "normal", true)).toBeGreaterThan(START_RATING);
    expect(updateRating(START_RATING, "normal", false)).toBeLessThan(START_RATING);
  });

  it("beating a stronger tier is worth more than beating a weaker one", () => {
    expect(updateRating(1000, "hard", true)).toBeGreaterThan(updateRating(1000, "easy", true));
  });

  it("picks the closest tier", () => {
    expect(pickDifficulty(START_RATING)).toBe("normal");
    expect(pickDifficulty(TIER_RATING.easy)).toBe("easy");
    expect(pickDifficulty(1400)).toBe("hard");
  });

  it("a player who keeps winning is moved up to hard bots", () => {
    let r = START_RATING;
    for (let i = 0; i < 20; i++) r = updateRating(r, pickDifficulty(r), true, 3);
    expect(pickDifficulty(r)).toBe("hard");
  });

  it("a player who keeps losing is moved down to easy bots", () => {
    let r = START_RATING;
    for (let i = 0; i < 20; i++) r = updateRating(r, pickDifficulty(r), false, 3);
    expect(pickDifficulty(r)).toBe("easy");
  });

  it("ignores bad stored values", () => {
    expect(parseRating(null)).toBe(START_RATING);
    expect(parseRating("abc")).toBe(START_RATING);
    expect(parseRating("99999")).toBe(START_RATING);
    expect(parseRating("1180")).toBe(1180);
  });
});
