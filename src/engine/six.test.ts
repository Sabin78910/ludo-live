import { describe, expect, it } from "vitest";
import { chooseMove } from "./bot";
import { applyMove, applyRoll, BASE, createGame, RuleError, seatColors, SIX_GEO, type GameState } from "./rules";

const six = (n = 6) => createGame(seatColors(n, true).map((color, i) => ({ color, name: `P${i}` })), { six: true });
const at = (s: GameState, tokens: number[][], current = 0): GameState => ({ ...s, tokens, current, phase: "roll", dice: null });

describe("6-player board rules", () => {
  it("seats 2 to 6 players with distinct colours spread around the hexagon", () => {
    expect(seatColors(6, true)).toHaveLength(6);
    expect(seatColors(2, true)).toEqual(["red", "green"]);
    expect(six().players).toHaveLength(6);
    expect(() => createGame(seatColors(6, true).map((color) => ({ color, name: "x" })))).toThrow(RuleError);
    expect(() => createGame(seatColors(4, true).map((color) => ({ color, name: "x" })), { six: true, teams: true })).toThrow(RuleError);
  });

  it("a token walks 77 squares before its home lane and finishes on 82", () => {
    const g = six(2);
    let s = at(g, [[SIX_GEO.lastTrack, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]);
    s = applyRoll(s, 6).state;
    s = applyMove(s, 0).state;
    expect(s.tokens[0][0]).toBe(SIX_GEO.finish);
  });

  it("captures on the shared 78-square loop", () => {
    const g = six(2); // red starts at 0, green at 39
    // Green token 3 squares past its start sits on loop square 42; red at progress 40 lands there with a 2.
    let s = at(g, [[40, BASE, BASE, BASE], [3, BASE, BASE, BASE]]);
    s = applyRoll(s, 2).state;
    const res = applyMove(s, 0);
    expect(res.events.some((e) => e.type === "capture")).toBe(true);
    expect(res.state.tokens[1][0]).toBe(BASE);
  });

  it("start squares are safe", () => {
    const g = six(2);
    let s = at(g, [[37, BASE, BASE, BASE], [0, BASE, BASE, BASE]]);
    s = applyRoll(s, 2).state;
    expect(applyMove(s, 0).events.some((e) => e.type === "capture")).toBe(false);
  });

  it("bots can play the bigger board", () => {
    let s = at(six(), [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]]);
    s = applyRoll(s, 3).state;
    expect(chooseMove(s, "hard")).toBe(0);
  });
});
