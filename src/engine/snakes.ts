// Snakes & Ladders rules: pure, no DOM. Uses the same fair dice as Ludo (see fair.ts).
export const LAST_SQUARE = 100;

/** Ludo Live's own layout: ladder foot → top. */
export const LADDERS: Readonly<Record<number, number>> = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
/** Snake head → tail. */
export const SNAKES: Readonly<Record<number, number>> = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 95: 77, 99: 41 };

export interface SnakesState {
  /** 0 = waiting off the board, 1..100 = square. */
  positions: number[];
  current: number;
  phase: "roll" | "over";
  winner: number | null;
  sixes: number;
  rollCount: number;
  rolls: { n: number; player: number; value: number }[];
}

export type SnakesEvent =
  | { type: "roll"; player: number; value: number }
  | { type: "walk"; player: number; path: number[] }
  | { type: "ladder"; player: number; from: number; to: number }
  | { type: "snake"; player: number; from: number; to: number }
  | { type: "bounce"; player: number }
  | { type: "threeSixes"; player: number }
  | { type: "win"; player: number };

export function createSnakes(players: number): SnakesState {
  if (players < 2 || players > 4) throw new Error("2 to 4 players");
  return { positions: Array(players).fill(0), current: 0, phase: "roll", winner: null, sixes: 0, rollCount: 0, rolls: [] };
}

/** Square number → column and row (row 0 at the top), boustrophedon like the printed board. */
export function cellOf(square: number): { col: number; row: number } {
  const i = square - 1;
  const fromBottom = Math.floor(i / 10);
  const col = fromBottom % 2 === 0 ? i % 10 : 9 - (i % 10);
  return { col, row: 9 - fromBottom };
}

/** Squares walked one by one; overshooting 100 bounces back by the extra. */
export function walkPath(from: number, roll: number): number[] {
  const path: number[] = [];
  let pos = from;
  let dir = 1;
  for (let i = 0; i < roll; i++) {
    if (pos === LAST_SQUARE) dir = -1;
    pos += dir;
    path.push(pos);
  }
  return path;
}

export function applySnakesRoll(prev: SnakesState, value: number): { state: SnakesState; events: SnakesEvent[] } {
  if (prev.phase !== "roll") throw new Error("game over");
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error("bad roll");
  const s: SnakesState = { ...prev, positions: [...prev.positions], rolls: [...prev.rolls] };
  const p = s.current;
  const events: SnakesEvent[] = [{ type: "roll", player: p, value }];
  s.rolls.push({ n: s.rollCount, player: p, value });
  s.rollCount++;
  s.sixes = value === 6 ? s.sixes + 1 : 0;

  if (s.sixes === 3) {
    events.push({ type: "threeSixes", player: p });
    return { state: next(s), events };
  }
  const path = walkPath(s.positions[p], value);
  events.push({ type: "walk", player: p, path });
  if (path.includes(LAST_SQUARE) && path[path.length - 1] !== LAST_SQUARE) events.push({ type: "bounce", player: p });
  let pos = path[path.length - 1];
  if (LADDERS[pos]) {
    events.push({ type: "ladder", player: p, from: pos, to: LADDERS[pos] });
    pos = LADDERS[pos];
  } else if (SNAKES[pos]) {
    events.push({ type: "snake", player: p, from: pos, to: SNAKES[pos] });
    pos = SNAKES[pos];
  }
  s.positions[p] = pos;
  if (pos === LAST_SQUARE) {
    events.push({ type: "win", player: p });
    return { state: { ...s, phase: "over", winner: p }, events };
  }
  return { state: value === 6 ? s : next(s), events };
}

function next(s: SnakesState): SnakesState {
  return { ...s, sixes: 0, current: (s.current + 1) % s.positions.length };
}

/** Wall-clock length of the animation for a roll, so bots wait for it. */
export function snakesAnimMs(events: SnakesEvent[], reduced: boolean, stepMs = 170): number {
  if (reduced) return 250;
  let ms = 650;
  for (const e of events) {
    if (e.type === "walk") ms += e.path.length * stepMs;
    if (e.type === "ladder" || e.type === "snake") ms += 700;
  }
  return ms;
}
