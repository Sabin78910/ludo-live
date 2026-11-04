import { snakesFrames } from "../ui/SnakesGame";
import { applySnakesRoll, cellOf, createSnakes, LADDERS, SNAKES, snakesAnimMs, walkPath, type SnakesState } from "./snakes";

const at = (positions: number[], current = 0): SnakesState => ({ ...createSnakes(positions.length), positions, current });

describe("snakes & ladders", () => {
  it("lays squares out in a zig-zag from the bottom left", () => {
    expect(cellOf(1)).toEqual({ col: 0, row: 9 });
    expect(cellOf(10)).toEqual({ col: 9, row: 9 });
    expect(cellOf(11)).toEqual({ col: 9, row: 8 });
    expect(cellOf(100)).toEqual({ col: 0, row: 0 });
  });

  it("has a sane board: ladders go up, snakes go down, no square is shared", () => {
    for (const [a, b] of Object.entries(LADDERS)) expect(b).toBeGreaterThan(+a);
    for (const [a, b] of Object.entries(SNAKES)) expect(b).toBeLessThan(+a);
    const ends = [...Object.entries(LADDERS), ...Object.entries(SNAKES)].flat().map(Number);
    expect(new Set(ends).size).toBe(ends.length);
    expect(ends).not.toContain(100);
  });

  it("walks forward and passes the turn", () => {
    const { state, events } = applySnakesRoll(at([0, 0]), 2);
    expect(state.positions).toEqual([2, 0]);
    expect(state.current).toBe(1);
    expect(events).toContainEqual({ type: "walk", player: 0, path: [1, 2] });
    expect(state.rolls).toEqual([{ n: 0, player: 0, value: 2 }]);
  });

  it("climbs ladders and slides down snakes", () => {
    expect(applySnakesRoll(at([0, 0]), 4).state.positions[0]).toBe(25);
    const s = applySnakesRoll(at([24, 0]), 3);
    expect(s.state.positions[0]).toBe(5);
    expect(s.events).toContainEqual({ type: "snake", player: 0, from: 27, to: 5 });
  });

  it("gives another roll on a six, but three sixes end the turn without moving", () => {
    let s = applySnakesRoll(at([1, 0]), 6).state;
    expect(s.current).toBe(0);
    s = applySnakesRoll(s, 6).state;
    const third = applySnakesRoll(s, 6);
    expect(third.events.map((e) => e.type)).toContain("threeSixes");
    expect(third.state.positions[0]).toBe(s.positions[0]);
    expect(third.state.current).toBe(1);
  });

  it("needs the exact roll to finish and bounces back on overshoot", () => {
    expect(walkPath(97, 5)).toEqual([98, 99, 100, 99, 98]);
    const b = applySnakesRoll(at([97, 0]), 5);
    expect(b.state.positions[0]).toBe(98);
    expect(b.events.map((e) => e.type)).toContain("bounce");
    const w = applySnakesRoll(at([96, 0]), 4);
    expect(w.state.phase).toBe("over");
    expect(w.state.winner).toBe(0);
    expect(() => applySnakesRoll(w.state, 1)).toThrow();
  });

  it("rejects bad input and times the animation", () => {
    expect(() => createSnakes(1)).toThrow();
    expect(() => applySnakesRoll(at([0, 0]), 7)).toThrow();
    const { events } = applySnakesRoll(at([0, 0]), 4);
    expect(snakesAnimMs(events, false)).toBeGreaterThan(snakesAnimMs(events, true));
  });

  it("animates a ladder as a walk then one long jump with a toast", () => {
    const frames = snakesFrames(applySnakesRoll(at([0, 0]), 4).events);
    expect(frames.map((f) => f.square)).toEqual([1, 2, 3, 4, 25]);
    expect(frames[4].toast).toEqual(["laddered", 25]);
  });
});
