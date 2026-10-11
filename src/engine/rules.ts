// Pure Ludo rules engine shared by the browser (bots, pass-and-play) and the Cloudflare Worker (online rooms).
// No DOM, no timers, no randomness: dice values are passed in, so the server stays authoritative and every
// roll can come from the provably fair dealer in fair.ts.

export type ClassicColor = "red" | "green" | "yellow" | "blue";
export type Color = ClassicColor | "orange" | "purple";
/** Clockwise seat order around the classic board. */
export const COLORS: readonly ClassicColor[] = ["red", "green", "yellow", "blue"];

export const TRACK_LEN = 52;
/** Last progress value on the shared track (the cell just before a player's home column). */
export const LAST_TRACK = 50;
/** Progress values 51..55 are the 5 home-column cells; 56 is the centre (finished). */
export const FINISH = 56;
export const BASE = -1;
export const TOKENS_PER_PLAYER = 4;

/** Index on the 52-cell track where each colour enters (also a safe cell). */
export const START_OFFSET: Record<ClassicColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
/** Star cells: 8 steps after each start. Start cells and stars are safe from capture. */
export const STAR_INDICES: readonly number[] = [8, 21, 34, 47];
export const SAFE_INDICES: ReadonlySet<number> = new Set([0, 13, 26, 39, ...STAR_INDICES]);

/** Everything that differs between board shapes: seats, track length, starts and stars. */
export interface BoardSpec {
  id: BoardId;
  /** Clockwise seat order. */
  colors: readonly Color[];
  trackLen: number;
  /** Last progress value on the shared track; the next 5 are the home column, then the centre (`finish`). */
  lastTrack: number;
  finish: number;
  startOffset: Partial<Record<Color, number>>;
  stars: readonly number[];
  /** Start cells and stars are safe from capture. */
  safe: ReadonlySet<number>;
}

export type BoardId = "classic" | "hex";

const CLASSIC: BoardSpec = {
  id: "classic",
  colors: COLORS,
  trackLen: TRACK_LEN,
  lastTrack: LAST_TRACK,
  finish: FINISH,
  startOffset: START_OFFSET,
  stars: STAR_INDICES,
  safe: SAFE_INDICES,
};

/** Six arms of 13 cells (78-cell track), stars 8 steps after each start. */
const HEX_COLORS: readonly Color[] = ["red", "orange", "green", "yellow", "blue", "purple"];
const HEX_STARTS = HEX_COLORS.map((_, i) => i * 13);
const HEX_STARS = HEX_STARTS.map((s) => s + 8);
const HEX: BoardSpec = {
  id: "hex",
  colors: HEX_COLORS,
  trackLen: 78,
  lastTrack: 76, // a full lap minus the start cell and the one before it, where the home column begins
  finish: 82,
  startOffset: Object.fromEntries(HEX_COLORS.map((c, i) => [c, HEX_STARTS[i]])),
  stars: HEX_STARS,
  safe: new Set([...HEX_STARTS, ...HEX_STARS]),
};

export const BOARDS: Record<BoardId, BoardSpec> = { classic: CLASSIC, hex: HEX };

export type Mode = "classic" | "quick";

export interface Player {
  color: Color;
  name: string;
}

export interface RollRecord {
  /** Global roll counter (the fair-dice index). */
  n: number;
  player: number;
  value: number;
}

export interface GameState {
  mode: Mode;
  /** Board shape; absent means the classic 4-player board. */
  board?: BoardId;
  players: Player[];
  /** tokens[playerIndex][tokenIndex] = progress (-1 base, 0..50 track, 51..55 home column, 56 finished). */
  tokens: number[][];
  current: number;
  phase: "roll" | "move" | "over";
  dice: number | null;
  /** Consecutive sixes rolled by the current player this turn. */
  sixes: number;
  rollCount: number;
  /** Player indices in finishing order (1st place first). */
  finished: number[];
  rolls: RollRecord[];
}

export type GameEvent =
  | { type: "roll"; player: number; value: number }
  | { type: "move"; player: number; token: number; from: number; to: number; path: number[] }
  | { type: "capture"; player: number; victim: number; token: number; cell: number }
  | { type: "home"; player: number; token: number }
  | { type: "bonus"; player: number; reason: "six" | "capture" | "home" }
  | { type: "forfeit"; player: number }
  | { type: "noMoves"; player: number }
  | { type: "finish"; player: number; place: number }
  | { type: "turn"; player: number }
  | { type: "over"; order: number[] };

export interface Step {
  state: GameState;
  events: GameEvent[];
}

export interface GameOptions {
  mode?: Mode;
  tokensPerPlayer?: number;
  board?: BoardId;
}

export function specOf(state: { board?: BoardId }): BoardSpec {
  return BOARDS[state.board ?? "classic"];
}

export class RuleError extends Error {}

export function createGame(players: Player[], opts: GameOptions = {}): GameState {
  const spec = BOARDS[opts.board ?? "classic"];
  if (players.length < 2 || players.length > spec.colors.length) {
    throw new RuleError(`Ludo needs 2 to ${spec.colors.length} players`);
  }
  const colors = new Set(players.map((p) => p.color));
  if (colors.size !== players.length) throw new RuleError("Each player needs a different colour");
  if (players.some((p) => !spec.colors.includes(p.color))) throw new RuleError("Colour is not on this board");
  const mode = opts.mode ?? "classic";
  const n = opts.tokensPerPlayer ?? TOKENS_PER_PLAYER;
  // Quick mode: every player starts with one token already on its start cell.
  const tokens = players.map(() => Array.from({ length: n }, (_, i) => (mode === "quick" && i === 0 ? 0 : BASE)));
  return {
    mode,
    ...(spec.id === "classic" ? {} : { board: spec.id }),
    players: players.map((p) => ({ ...p })),
    tokens,
    current: 0,
    phase: "roll",
    dice: null,
    sixes: 0,
    rollCount: 0,
    finished: [],
    rolls: [],
  };
}

/** Seat colours for a table of n players: 2 players sit opposite each other. */
export function seatColors(n: number, board: BoardId = "classic"): Color[] {
  const all = BOARDS[board].colors;
  if (n < 2 || n > all.length) throw new RuleError(`Ludo needs 2 to ${all.length} players`);
  if (board === "classic") return n === 2 ? ["red", "yellow"] : n === 3 ? ["red", "green", "yellow"] : [...all];
  // Hex: spread the seats evenly around the six arms.
  const picks = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[n]!;
  return picks.map((i) => all[i]);
}

/** Absolute track index of a token, or null when it is in base, the home column or finished. */
export function trackIndex(color: Color, progress: number, spec: BoardSpec = CLASSIC): number | null {
  if (progress < 0 || progress > spec.lastTrack) return null;
  return ((spec.startOffset[color] ?? 0) + progress) % spec.trackLen;
}

export function isSafeIndex(index: number, spec: BoardSpec = CLASSIC): boolean {
  return spec.safe.has(index);
}

/** Where a token at `progress` lands with `roll`, or null if it cannot move. */
export function target(progress: number, roll: number, spec: BoardSpec = CLASSIC): number | null {
  if (roll < 1 || roll > 6) return null;
  if (progress === BASE) return roll === 6 ? 0 : null;
  if (progress >= spec.finish) return null;
  const to = progress + roll;
  return to > spec.finish ? null : to; // exact roll needed to finish
}

export function legalMoves(state: GameState): number[] {
  if (state.phase !== "move" || state.dice === null) return [];
  const mine = state.tokens[state.current];
  const spec = specOf(state);
  const out: number[] = [];
  mine.forEach((p, i) => {
    if (target(p, state.dice!, spec) !== null) out.push(i);
  });
  return out;
}

/** Legal moves with duplicates removed (e.g. four tokens in base all lead to the same result). */
export function distinctMoves(state: GameState): number[] {
  const seen = new Set<number>();
  return legalMoves(state).filter((i) => {
    const p = state.tokens[state.current][i];
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

/** The single token to auto-move when there is no real choice, else null. */
export function autoMove(state: GameState): number | null {
  const d = distinctMoves(state);
  return d.length === 1 ? d[0] : null;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p })),
    tokens: state.tokens.map((t) => [...t]),
    finished: [...state.finished],
    rolls: [...state.rolls],
  };
}

function active(state: GameState): number[] {
  return state.players.map((_, i) => i).filter((i) => !state.finished.includes(i));
}

function advanceTurn(s: GameState, events: GameEvent[]): void {
  s.sixes = 0;
  s.dice = null;
  if (s.phase === "over") return;
  const n = s.players.length;
  for (let k = 1; k <= n; k++) {
    const next = (s.current + k) % n;
    if (!s.finished.includes(next)) {
      s.current = next;
      break;
    }
  }
  s.phase = "roll";
  events.push({ type: "turn", player: s.current });
}

function endGame(s: GameState, events: GameEvent[]): void {
  // Remaining players are ranked by how far their tokens have travelled.
  const rest = active(s).sort((a, b) => totalProgress(s, b) - totalProgress(s, a));
  s.finished.push(...rest);
  s.phase = "over";
  s.dice = null;
  events.push({ type: "over", order: [...s.finished] });
}

export function totalProgress(state: GameState, player: number): number {
  return state.tokens[player].reduce((sum, p) => sum + (p < 0 ? 0 : p + 1), 0);
}

/** Apply a dice roll for the current player. */
export function applyRoll(state: GameState, value: number): Step {
  if (state.phase !== "roll") throw new RuleError("Not time to roll");
  if (!Number.isInteger(value) || value < 1 || value > 6) throw new RuleError("Dice value must be 1-6");
  const s = clone(state);
  const events: GameEvent[] = [{ type: "roll", player: s.current, value }];
  s.rolls.push({ n: s.rollCount, player: s.current, value });
  s.rollCount += 1;
  s.dice = value;
  if (value === 6) {
    s.sixes += 1;
    if (s.sixes >= 3) {
      events.push({ type: "forfeit", player: s.current });
      advanceTurn(s, events);
      return { state: s, events };
    }
  }
  s.phase = "move";
  if (legalMoves(s).length === 0) {
    events.push({ type: "noMoves", player: s.current });
    advanceTurn(s, events);
  }
  return { state: s, events };
}

/** Move one of the current player's tokens by the rolled value. */
export function applyMove(state: GameState, token: number): Step {
  if (state.phase !== "move" || state.dice === null) throw new RuleError("Roll first");
  const me = state.current;
  const from = state.tokens[me]?.[token];
  if (from === undefined) throw new RuleError("No such token");
  const to = target(from, state.dice, specOf(state));
  if (to === null) throw new RuleError("That token cannot move");
  const s = clone(state);
  const events: GameEvent[] = [];
  const path: number[] = [];
  if (from === BASE) path.push(0);
  else for (let p = from + 1; p <= to; p++) path.push(p);
  s.tokens[me][token] = to;
  events.push({ type: "move", player: me, token, from, to, path });

  let captured = false;
  const color = s.players[me].color;
  const spec = specOf(s);
  const cell = trackIndex(color, to, spec);
  if (cell !== null && !isSafeIndex(cell, spec)) {
    s.players.forEach((p, other) => {
      if (other === me) return;
      s.tokens[other].forEach((op, ti) => {
        if (trackIndex(p.color, op, spec) === cell) {
          s.tokens[other][ti] = BASE;
          captured = true;
          events.push({ type: "capture", player: me, victim: other, token: ti, cell });
        }
      });
    });
  }

  const reachedHome = to === spec.finish;
  if (reachedHome) events.push({ type: "home", player: me, token });

  if (reachedHome && s.mode === "quick") {
    s.finished.push(me);
    events.push({ type: "finish", player: me, place: 1 });
    endGame(s, events);
    return { state: s, events };
  }
  if (s.tokens[me].every((p) => p === spec.finish)) {
    s.finished.push(me);
    events.push({ type: "finish", player: me, place: s.finished.length });
    if (active(s).length <= 1) {
      endGame(s, events);
      return { state: s, events };
    }
    advanceTurn(s, events);
    return { state: s, events };
  }

  const dice = s.dice!;
  const reason = captured ? "capture" : reachedHome ? "home" : dice === 6 ? "six" : null;
  if (reason) {
    events.push({ type: "bonus", player: me, reason });
    if (dice !== 6) s.sixes = 0; // a capture/home bonus breaks the run of sixes
    s.dice = null;
    s.phase = "roll";
  } else {
    advanceTurn(s, events);
  }
  return { state: s, events };
}

/** Skip the current player's turn (used when a turn timer runs out with nothing to do). */
export function passTurn(state: GameState): Step {
  if (state.phase === "over") throw new RuleError("Game over");
  const s = clone(state);
  const events: GameEvent[] = [];
  advanceTurn(s, events);
  return { state: s, events };
}

/** Number of steps each event's token animation takes, for pacing bots and UI. */
export function animationSteps(events: GameEvent[]): number {
  return events.reduce((n, e) => n + (e.type === "move" ? e.path.length : e.type === "capture" ? 4 : 0), 0);
}
