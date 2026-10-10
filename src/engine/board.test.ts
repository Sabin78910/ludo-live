import { BASE_ORIGIN, GRID, HOME_COLUMN, TRACK, cellKind, startCell, tokenPosition } from "./board";
import { COLORS, FINISH, LAST_TRACK, STAR_INDICES } from "./rules";

describe("board geometry", () => {
  it("has 52 unique track cells inside the grid", () => {
    expect(TRACK).toHaveLength(52);
    expect(new Set(TRACK.map(([r, c]) => `${r},${c}`)).size).toBe(52);
    for (const [r, c] of TRACK) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(GRID);
    }
  });
  it("each track cell is orthogonally adjacent to the next (closed loop)", () => {
    for (let i = 0; i < TRACK.length; i++) {
      const [r1, c1] = TRACK[i];
      const [r2, c2] = TRACK[(i + 1) % TRACK.length];
      const d = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      // Corners of the cross step diagonally (e.g. (6,5) to (5,6)), as on a real board.
      expect(d === 1 || (Math.abs(r1 - r2) === 1 && Math.abs(c1 - c2) === 1)).toBe(true);
    }
  });
  it("places starts on the classic cells", () => {
    expect(startCell("red")).toEqual([6, 1]);
    expect(startCell("green")).toEqual([1, 8]);
    expect(startCell("yellow")).toEqual([8, 13]);
    expect(startCell("blue")).toEqual([13, 6]);
  });
  it("each home column starts next to the colour's last track cell", () => {
    for (const color of COLORS) {
      const [lr, lc] = tokenPosition(color, LAST_TRACK, 0).map((v) => v - 0.5);
      const [hr, hc] = HOME_COLUMN[color][0];
      expect(Math.abs(lr - hr) + Math.abs(lc - hc)).toBe(1);
      expect(HOME_COLUMN[color]).toHaveLength(5);
    }
  });
  it("classifies cells", () => {
    expect(cellKind(6, 1)).toEqual({ kind: "track", index: 0 });
    expect(cellKind(7, 3)).toEqual({ kind: "home", color: "red" });
    expect(cellKind(7, 7)).toEqual({ kind: "center" });
    expect(cellKind(2, 2)).toEqual({ kind: "base", color: "red" });
    expect(cellKind(12, 12)).toEqual({ kind: "base", color: "yellow" });
  });
  it("stars are on the track", () => {
    for (const s of STAR_INDICES) expect(cellKind(...TRACK[s])).toEqual({ kind: "track", index: s });
  });
  it("puts base tokens inside their yard and finished tokens in the centre", () => {
    for (const color of COLORS) {
      const [br, bc] = BASE_ORIGIN[color];
      for (let t = 0; t < 4; t++) {
        const [r, c] = tokenPosition(color, -1, t);
        expect(r).toBeGreaterThan(br);
        expect(r).toBeLessThan(br + 6);
        expect(c).toBeGreaterThan(bc);
        expect(c).toBeLessThan(bc + 6);
        const [fr, fc] = tokenPosition(color, FINISH, t);
        expect(fr).toBeGreaterThan(6);
        expect(fr).toBeLessThan(9);
        expect(fc).toBeGreaterThan(6);
        expect(fc).toBeLessThan(9);
      }
    }
  });
});
