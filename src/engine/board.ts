// Board geometry for a classic 15x15 Ludo board. Coordinates are [row, col] cell centres (x.5 values),
// so the renderer can place tokens with percentages. Red base is top-left, then clockwise:
// green top-right, yellow bottom-right, blue bottom-left.
import { BASE, BOARDS, FINISH, LAST_TRACK, START_OFFSET, TRACK_LEN, type BoardId, type ClassicColor, type Color } from "./rules";

export const GRID = 15;
export type Cell = readonly [row: number, col: number];

function segment(cells: [number, number][]): [number, number][] {
  return cells;
}

/** The 52 shared track cells, index 0 = red start, running clockwise. */
export const TRACK: readonly Cell[] = (() => {
  const c: [number, number][] = [];
  const push = (list: [number, number][]) => c.push(...list);
  push(segment([1, 2, 3, 4, 5].map((col) => [6, col])));
  push(segment([5, 4, 3, 2, 1, 0].map((row) => [row, 6])));
  push([[0, 7]]);
  push(segment([0, 1, 2, 3, 4, 5].map((row) => [row, 8])));
  push(segment([9, 10, 11, 12, 13, 14].map((col) => [6, col])));
  push([[7, 14]]);
  push(segment([14, 13, 12, 11, 10, 9].map((col) => [8, col])));
  push(segment([9, 10, 11, 12, 13, 14].map((row) => [row, 8])));
  push([[14, 7]]);
  push(segment([14, 13, 12, 11, 10, 9].map((row) => [row, 6])));
  push(segment([5, 4, 3, 2, 1, 0].map((col) => [8, col])));
  push([[7, 0]]);
  push([[6, 0]]);
  return c;
})();

/** Home-column cells (progress 51..55) per colour, outermost first. */
export const HOME_COLUMN: Record<ClassicColor, readonly Cell[]> = {
  red: [1, 2, 3, 4, 5].map((col) => [7, col] as const),
  green: [1, 2, 3, 4, 5].map((row) => [row, 7] as const),
  yellow: [13, 12, 11, 10, 9].map((col) => [7, col] as const),
  blue: [13, 12, 11, 10, 9].map((row) => [row, 7] as const),
};

/** Top-left cell of each 6x6 base yard. */
export const BASE_ORIGIN: Record<ClassicColor, Cell> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };

const BASE_SLOTS: readonly Cell[] = [
  [1.9, 1.9],
  [1.9, 4.1],
  [4.1, 1.9],
  [4.1, 4.1],
];

/** Where finished tokens rest inside the centre triangle of their colour. */
const FINISH_SPOT: Record<ClassicColor, Cell> = { red: [7.5, 6.55], green: [6.55, 7.5], yellow: [7.5, 8.45], blue: [8.45, 7.5] };

const center = (cell: Cell): Cell => [cell[0] + 0.5, cell[1] + 0.5];

/** Board position (cell centre, in cell units) of a token. */
export function tokenPosition(color: Color, progress: number, tokenIndex: number, board: BoardId = "classic"): Cell {
  if (board === "hex") return hexPosition(color, progress, tokenIndex);
  const c4 = color as ClassicColor;
  if (progress === BASE) {
    const [r, c] = BASE_ORIGIN[c4];
    const [sr, sc] = BASE_SLOTS[tokenIndex % 4];
    return [r + sr, c + sc];
  }
  if (progress >= FINISH) {
    const [r, c] = FINISH_SPOT[c4];
    const spread = (tokenIndex - 1.5) * 0.28;
    return color === "red" || color === "yellow" ? [r + spread, c] : [r, c + spread];
  }
  if (progress > LAST_TRACK) return center(HOME_COLUMN[c4][progress - LAST_TRACK - 1]);
  return center(TRACK[(START_OFFSET[c4] + progress) % TRACK_LEN]);
}

export function startCell(color: ClassicColor): Cell {
  return TRACK[START_OFFSET[color]];
}

/** Classify every grid cell for drawing the board. */
export type CellKind =
  | { kind: "base"; color: ClassicColor }
  | { kind: "track"; index: number }
  | { kind: "home"; color: ClassicColor }
  | { kind: "center" }
  | { kind: "empty" };

export function cellKind(row: number, col: number): CellKind {
  const t = TRACK.findIndex(([r, c]) => r === row && c === col);
  if (t >= 0) return { kind: "track", index: t };
  for (const color of Object.keys(HOME_COLUMN) as ClassicColor[]) {
    if (HOME_COLUMN[color].some(([r, c]) => r === row && c === col)) return { kind: "home", color };
  }
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return { kind: "center" };
  for (const color of Object.keys(BASE_ORIGIN) as ClassicColor[]) {
    const [r, c] = BASE_ORIGIN[color];
    if (row >= r && row < r + 6 && col >= c && col < c + 6) return { kind: "base", color };
  }
  return { kind: "empty" };
}

// Hex board: six arms 60 degrees apart around a hub, 13 track cells per arm (78 in all). Positions are cell
// centres in a HEX_SIZE square. Arm k of the board points at 270 + 60k degrees clockwise from up (red on the left).
export const HEX_SIZE = 20;
const HUB = 2;

const armPoint = (arm: number, lateral: number, dist: number): Cell => {
  const a = ((270 + 60 * arm) * Math.PI) / 180;
  const [sin, cos] = [Math.sin(a), Math.cos(a)];
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return [round(HEX_SIZE / 2 - dist * cos + lateral * sin), round(HEX_SIZE / 2 + dist * sin + lateral * cos)];
};

/** Track cell j (0..12) of an arm: out along the left lane, round the tip, back along the right lane. */
const armCell = (arm: number, j: number): Cell =>
  j < 6 ? armPoint(arm, -1, HUB + j + 1) : j === 6 ? armPoint(arm, 0, HUB + 6) : armPoint(arm, 1, HUB + 13 - j);

/** The 78 shared track cells; a colour starts at 13 * its seat (the second cell back along its right lane). */
export const HEX_TRACK: readonly Cell[] = (() => {
  const out: Cell[] = [];
  for (let arm = 0; arm < 6; arm++) for (let j = 0; j < 13; j++) out[(13 * arm - 8 + j + 78) % 78] = armCell(arm, j);
  return out;
})();

const hexArm = (color: Color) => BOARDS.hex.colors.indexOf(color);

/** Home-column cells (progress 51..55) for a hex colour, outermost first. */
export const hexHomeColumn = (color: Color): readonly Cell[] =>
  [0, 1, 2, 3, 4].map((i) => armPoint(hexArm(color), 0, HUB + 5 - i));

/** The four resting spots of a colour's yard, between its arm and the previous one. */
export const hexYard = (color: Color): readonly Cell[] => {
  const [cy, cx] = armPoint(hexArm(color), -3.8, 7.5);
  return [-0.6, 0.6].flatMap((dy) => [-0.6, 0.6].map((dx): Cell => [cy + dy, cx + dx]));
};

function hexPosition(color: Color, progress: number, tokenIndex: number): Cell {
  if (progress === BASE) return hexYard(color)[tokenIndex % 4];
  if (progress >= BOARDS.hex.finish) {
    const [r, c] = armPoint(hexArm(color), (tokenIndex - 1.5) * 0.28, HUB - 0.9);
    return [r, c];
  }
  if (progress > BOARDS.hex.lastTrack) return hexHomeColumn(color)[progress - BOARDS.hex.lastTrack - 1];
  return HEX_TRACK[(BOARDS.hex.startOffset[color]! + progress) % 78];
}
