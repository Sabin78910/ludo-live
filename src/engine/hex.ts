// Geometry for the 6-player hexagon board: a hexagon hub, six arms of 3 x 6 squares and a triangular
// yard between each pair of arms. Positions are [y, x] in board units (0..HEX_SIZE), like board.ts.
import { BASE, SIX_COLORS, SIX_GEO, type Color } from "./rules";

const A = (3 * Math.sqrt(3)) / 2; // hub apothem: a hexagon with 3-square sides
const ARM = 6;
const R = A + ARM;
export const HEX_SIZE = 2 * R + 0.8;
const O = HEX_SIZE / 2;

export type Pt = readonly [y: number, x: number];

const angle = (arm: number) => ((180 + 60 * arm) * Math.PI) / 180;
/** Unit vector out along an arm, and its clockwise perpendicular. */
export function axes(arm: number) {
  const a = angle(arm);
  const u = [Math.cos(a), Math.sin(a)] as const;
  const p = [-Math.sin(a), Math.cos(a)] as const;
  return { u, p };
}

/** Centre of the square in lane x (-1, 0, 1) at depth d (0 at the hub, 5 at the tip) of an arm. */
export function armCell(arm: number, lane: number, d: number): Pt {
  const { u, p } = axes(arm);
  const r = A + d + 0.5;
  return [O + u[1] * r + p[1] * lane, O + u[0] * r + p[0] * lane];
}

/** The 78 loop squares in walking order, indexed like the rules engine (index 0 = first colour's start). */
export const HEX_TRACK: readonly Pt[] = (() => {
  const loop: Pt[] = [];
  for (let arm = 0; arm < 6; arm++) {
    for (let d = 0; d < ARM; d++) loop.push(armCell(arm, -1, d));
    loop.push(armCell(arm, 0, ARM - 1));
    for (let d = ARM - 1; d >= 0; d--) loop.push(armCell(arm, 1, d));
  }
  // Each colour starts on the second square of its arm's clockwise lane: loop index 13k + 8.
  return loop.map((_, i) => loop[(i + 8) % loop.length]);
})();

const armOf = (color: Color) => Math.max(0, SIX_COLORS.indexOf(color));

/** Home-lane squares (progress lastTrack+1 .. lastTrack+5), outermost first. */
export function hexHomeLane(color: Color): Pt[] {
  return [4, 3, 2, 1, 0].map((d) => armCell(armOf(color), 0, d));
}

/** Corners of the triangular yard between a colour's arm and the next arm clockwise. */
export function hexYard(color: Color): Pt[] {
  const k = armOf(color);
  const a = axes(k);
  const b = axes((k + 1) % 6);
  const mid = angle(k) + Math.PI / 6;
  const hub = 3; // distance from centre to a hub corner
  return [
    [O + Math.sin(mid) * hub, O + Math.cos(mid) * hub],
    [O + a.u[1] * R + a.p[1] * 1.5, O + a.u[0] * R + a.p[0] * 1.5],
    [O + b.u[1] * R - b.p[1] * 1.5, O + b.u[0] * R - b.p[0] * 1.5],
  ];
}

export function hexYardCentre(color: Color): Pt {
  const t = hexYard(color);
  return [(t[0][0] + t[1][0] + t[2][0]) / 3 + 0, (t[0][1] + t[1][1] + t[2][1]) / 3];
}

/** Hub corners, for drawing the centre hexagon. */
export function hexHub(): Pt[] {
  return Array.from({ length: 6 }, (_, k) => {
    const mid = angle(k) + Math.PI / 6;
    return [O + Math.sin(mid) * 3, O + Math.cos(mid) * 3] as Pt;
  });
}

/** Board position of a token on the hexagon board. */
export function hexTokenPosition(color: Color, progress: number, tokenIndex: number): Pt {
  const g = SIX_GEO;
  if (progress === BASE) {
    const [cy, cx] = hexYardCentre(color);
    const slot = [
      [-0.55, -0.55],
      [-0.55, 0.55],
      [0.55, -0.55],
      [0.55, 0.55],
    ][tokenIndex % 4];
    return [cy + slot[0] * 1.1, cx + slot[1] * 1.1];
  }
  if (progress >= g.finish) {
    const { u, p } = axes(armOf(color));
    const s = (tokenIndex - 1.5) * 0.3;
    return [O + u[1] * 1.4 + p[1] * s, O + u[0] * 1.4 + p[0] * s];
  }
  if (progress > g.lastTrack) return hexHomeLane(color)[progress - g.lastTrack - 1];
  return HEX_TRACK[(g.start[color] + progress) % g.trackLen];
}
