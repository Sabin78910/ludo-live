// Bot players. Heuristics score every legal move on capture, safety and progress.
// easy: mostly random; normal: heuristic with noise; hard: full heuristic including threat analysis.
import {
  BASE,
  geoOf,
  isSafeIndex,
  legalMoves,
  target,
  trackIndex,
  sameSide,
  type GameState,
} from "./rules";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** Opponent tokens that could land on `cell` with a single roll of 1..6. */
export function threatsTo(state: GameState, player: number, cell: number): number {
  const g = geoOf(state);
  let n = 0;
  state.players.forEach((p, other) => {
    if (sameSide(state, player, other)) return;
    state.tokens[other].forEach((op) => {
      const at = trackIndex(p.color, op, g);
      // Tokens in base can only enter onto their own start cell, which is safe, so they are no threat.
      if (at === null) return;
      const dist = (cell - at + g.trackLen) % g.trackLen;
      // The opponent must still be on the shared track when it reaches the cell.
      if (dist >= 1 && dist <= 6 && op + dist <= g.lastTrack) n += 1;
    });
  });
  return n;
}

export interface MoveScore {
  token: number;
  score: number;
}

export function scoreMoves(state: GameState, hard = false): MoveScore[] {
  const g = geoOf(state);
  const me = state.current;
  const color = state.players[me].color;
  const dice = state.dice ?? 0;
  return legalMoves(state).map((token) => {
    const from = state.tokens[me][token];
    const to = target(from, dice, g)!;
    let score = 0;
    const cell = trackIndex(color, to, g);
    const safe = cell === null || isSafeIndex(cell, g);
    // Captures
    if (cell !== null && !isSafeIndex(cell, g)) {
      state.players.forEach((p, other) => {
        if (sameSide(state, me, other)) return;
        state.tokens[other].forEach((op) => {
          if (trackIndex(p.color, op, g) === cell) score += 100 + (hard ? op * 1.2 : 0);
        });
      });
    }
    if (to === g.finish) score += 70;
    if (from === BASE) score += 55;
    if (from <= g.lastTrack && to > g.lastTrack) score += 35; // reaches the safe home column
    if (safe && cell !== null) score += 20;
    if (!safe) score -= threatsTo(state, me, cell!) * (hard ? 32 : 18);
    if (hard && from >= 0 && from <= g.lastTrack) {
      const fromCell = trackIndex(color, from, g)!;
      if (!isSafeIndex(fromCell, g)) score += threatsTo(state, me, fromCell) * 22; // escape danger
    }
    score += to * (hard ? 0.4 : 0.25);
    return { token, score };
  });
}

/** Why a bot picked a move, in priority order, so players can see the bot's reasoning. */
export type MoveReason = "capture" | "finish" | "enter" | "homeColumn" | "escape" | "safe" | "advance";

export function explainMove(state: GameState, token: number): MoveReason {
  const g = geoOf(state);
  const me = state.current;
  const color = state.players[me].color;
  const from = state.tokens[me][token];
  const to = target(from, state.dice ?? 0, g);
  if (to === null) return "advance";
  const cell = trackIndex(color, to, g);
  if (cell !== null && !isSafeIndex(cell, g)) {
    const hits = state.players.some(
      (p, other) => !sameSide(state, me, other) && state.tokens[other].some((op) => trackIndex(p.color, op, g) === cell),
    );
    if (hits) return "capture";
  }
  if (to === g.finish) return "finish";
  if (from === BASE) return "enter";
  if (from <= g.lastTrack && to > g.lastTrack) return "homeColumn";
  if (from >= 0 && from <= g.lastTrack) {
    const fromCell = trackIndex(color, from, g)!;
    if (!isSafeIndex(fromCell, g) && threatsTo(state, me, fromCell) > 0 && (cell === null || isSafeIndex(cell, g) || threatsTo(state, me, cell) === 0)) return "escape";
  }
  if (cell !== null && isSafeIndex(cell, g)) return "safe";
  return "advance";
}

/** Pick a token to move. `rand` returns [0,1) so tests can seed it. */
export function chooseMove(state: GameState, difficulty: Difficulty, rand: () => number = Math.random): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal moves");
  if (moves.length === 1) return moves[0];
  if (difficulty === "easy" && rand() < 0.6) return moves[Math.floor(rand() * moves.length)];
  const scored = scoreMoves(state, difficulty === "hard");
  const noise = difficulty === "normal" ? 25 : difficulty === "easy" ? 60 : 0;
  let best = scored[0];
  let bestValue = -Infinity;
  for (const m of scored) {
    const v = m.score + (noise ? rand() * noise : 0);
    if (v > bestValue) {
      bestValue = v;
      best = m;
    }
  }
  return best.token;
}

/** Small seeded PRNG (mulberry32) for deterministic bots in tests and simulations. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
