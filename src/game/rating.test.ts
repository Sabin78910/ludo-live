import { START_RATING } from "../engine/elo";
import { applyGameResult, loadRating, parseRating } from "./rating";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("rating storage", () => {
  it("starts at 1200 and survives corrupt data", () => {
    expect(loadRating(mem())).toEqual({ rating: START_RATING, last: null });
    expect(parseRating("nope").rating).toBe(START_RATING);
    expect(parseRating('{"rating":-5}').rating).toBe(START_RATING);
  });
  it("applies a game's delta once", () => {
    const s = mem();
    expect(applyGameResult(12, "g1", s).rating).toBe(1212);
    expect(applyGameResult(12, "g1", s).rating).toBe(1212);
    expect(applyGameResult(-20, "g2", s).rating).toBe(1192);
    expect(loadRating(s).rating).toBe(1192);
  });
});
