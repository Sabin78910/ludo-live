// Board geometry for a classic 15x15 Ludo board. Coordinates are [row, col] cell centres (x.5 values),
// so the renderer can place tokens with percentages. Red base is top-left, then clockwise:
// green top-right, yellow bottom-right, blue bottom-left.
import { BASE, FINISH, LAST_TRACK, START_OFFSET, TRACK_LEN, type Color } from "./rules";

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
export const HOME_COLUMN: Record<Color, readonly Cell[]> = {
  red: [1, 2, 3, 4, 5].map((col) => [7, col] as const),
  green: [1, 2, 3, 4, 5].map((row) => [row, 7] as const),
  yellow: [13, 12, 11, 10, 9].map((col) => [7, col] as const),
  blue: [13, 12, 11, 10, 9].map((row) => [row, 7] as const),
};

/** Top-left cell of each 6x6 base yard. */
export const BASE_ORIGIN: Record<Color, Cell> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };

const BASE_SLOTS: readonly Cell[] = [
  [1.9, 1.9],
  [1.9, 4.1],
  [4.1, 1.9],
  [4.1, 4.1],
];

/** Where finished tokens rest inside the centre triangle of their colour. */
const FINISH_SPOT: Record<Color, Cell> = { red: [7.5, 6.55], green: [6.55, 7.5], yellow: [7.5, 8.45], blue: [8.45, 7.5] };

const center = (cell: Cell): Cell => [cell[0] + 0.5, cell[1] + 0.5];

/** Board position (cell centre, in cell units) of a token. */
export function tokenPosition(color: Color, progress: number, tokenIndex: number): Cell {
  if (progress === BASE) {
    const [r, c] = BASE_ORIGIN[color];
    const [sr, sc] = BASE_SLOTS[tokenIndex % 4];
    return [r + sr, c + sc];
  }
  if (progress >= FINISH) {
    const [r, c] = FINISH_SPOT[color];
    const spread = (tokenIndex - 1.5) * 0.28;
    return color === "red" || color === "yellow" ? [r + spread, c] : [r, c + spread];
  }
  if (progress > LAST_TRACK) return center(HOME_COLUMN[color][progress - LAST_TRACK - 1]);
  return center(TRACK[(START_OFFSET[color] + progress) % TRACK_LEN]);
}

export function startCell(color: Color): Cell {
  return TRACK[START_OFFSET[color]];
}

/** Classify every grid cell for drawing the board. */
export type CellKind =
  | { kind: "base"; color: Color }
  | { kind: "track"; index: number }
  | { kind: "home"; color: Color }
  | { kind: "center" }
  | { kind: "empty" };

export function cellKind(row: number, col: number): CellKind {
  const t = TRACK.findIndex(([r, c]) => r === row && c === col);
  if (t >= 0) return { kind: "track", index: t };
  for (const color of Object.keys(HOME_COLUMN) as Color[]) {
    if (HOME_COLUMN[color].some(([r, c]) => r === row && c === col)) return { kind: "home", color };
  }
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return { kind: "center" };
  for (const color of Object.keys(BASE_ORIGIN) as Color[]) {
    const [r, c] = BASE_ORIGIN[color];
    if (row >= r && row < r + 6 && col >= c && col < c + 6) return { kind: "base", color };
  }
  return { kind: "empty" };
}
