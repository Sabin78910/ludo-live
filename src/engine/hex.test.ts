import { describe, expect, it } from "vitest";
import { HEX_SIZE, HEX_TRACK, hexHomeLane, hexTokenPosition } from "./hex";
import { BASE, SIX_COLORS, SIX_GEO } from "./rules";

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("hexagon board geometry", () => {
  it("has 78 distinct loop squares inside the board", () => {
    expect(HEX_TRACK).toHaveLength(78);
    const keys = new Set(HEX_TRACK.map(([y, x]) => `${y.toFixed(2)},${x.toFixed(2)}`));
    expect(keys.size).toBe(78);
    for (const [y, x] of HEX_TRACK) {
      expect(y).toBeGreaterThan(0);
      expect(x).toBeGreaterThan(0);
      expect(y).toBeLessThan(HEX_SIZE);
      expect(x).toBeLessThan(HEX_SIZE);
    }
  });

  it("the loop is walkable: every step moves to a neighbouring square", () => {
    HEX_TRACK.forEach((c, i) => expect(dist(c, HEX_TRACK[(i + 1) % 78])).toBeLessThan(1.6));
  });

  it("each colour's walk ends next to its own home lane, which leads to the centre", () => {
    for (const c of SIX_COLORS) {
      const last = hexTokenPosition(c, SIX_GEO.lastTrack, 0);
      const lane = hexHomeLane(c);
      expect(dist(last, lane[0])).toBeLessThan(1.05);
      lane.slice(1).forEach((cell, i) => expect(dist(cell, lane[i])).toBeLessThan(1.05));
      const centre = [HEX_SIZE / 2, HEX_SIZE / 2];
      expect(dist(lane[4], centre)).toBeLessThan(dist(lane[0], centre));
    }
  });

  it("yard tokens sit apart and away from the track", () => {
    for (const c of SIX_COLORS) {
      const spots = [0, 1, 2, 3].map((t) => hexTokenPosition(c, BASE, t));
      for (const s of spots) for (const t of HEX_TRACK) expect(dist(s, t)).toBeGreaterThan(0.7);
    }
  });
});
